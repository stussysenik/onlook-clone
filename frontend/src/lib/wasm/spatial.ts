/**
 * wasm-spatial TypeScript wrapper — R-tree spatial index.
 *
 * Provides O(log n) hit testing and rectangle queries via an R-tree
 * implemented in Rust. Falls back to linear scan when WASM isn't available.
 */

import { isModuleLoaded } from './loader';
import type { CanvasElement } from '$lib/types/element';

// Lazy reference to the WASM module
let wasmSpatial: typeof import('wasm-spatial') | null = null;
let index: InstanceType<typeof import('wasm-spatial')['SpatialIndex']> | null = null;

async function getWasm(): Promise<typeof import('wasm-spatial') | null> {
	if (wasmSpatial) return wasmSpatial;
	if (!isModuleLoaded('spatial')) return null;
	try {
		wasmSpatial = await import('wasm-spatial');
		return wasmSpatial;
	} catch {
		return null;
	}
}

// Eagerly try to load
getWasm().then((mod) => {
	if (mod) {
		index = new mod.SpatialIndex();
		console.info('[wasm-spatial] Index created');
	}
});

/** Check if the spatial index is ready. */
export function isLoaded(): boolean {
	return index !== null;
}

/** Bulk load all elements into the index. */
export function bulkLoad(elements: CanvasElement[]): void {
	if (index) {
		const data = elements.map((el) => ({
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
			z_index: el.z_index,
			visible: el.visible,
			locked: el.locked
		}));
		index.bulk_load(JSON.stringify(data));
	}
}

/** Insert or update a single element. */
export function upsert(el: CanvasElement): void {
	if (index) {
		index.upsert(el.id, el.x, el.y, el.width, el.height, el.z_index, el.visible, el.locked);
	}
}

/** Remove an element from the index. */
export function remove(id: string): void {
	if (index) {
		index.remove(id);
	}
}

/**
 * Hit test at a point in canvas-space.
 *
 * Returns the ID of the top-most visible, unlocked element, or null.
 * Falls back to linear scan over all elements when WASM isn't available.
 */
export function hitTest(
	x: number,
	y: number,
	fallbackElements?: CanvasElement[]
): string | null {
	if (index) {
		const id = index.hit_test(x, y);
		return id || null;
	}

	// JS fallback: linear scan (sorted by z_index descending)
	if (!fallbackElements) return null;
	const sorted = [...fallbackElements].sort((a, b) => b.z_index - a.z_index);
	for (const el of sorted) {
		if (!el.visible || el.locked) continue;
		if (x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height) {
			return el.id;
		}
	}
	return null;
}

/**
 * Query all elements intersecting a rectangle (marquee selection).
 *
 * Returns an array of element IDs.
 */
export function queryRect(
	x: number,
	y: number,
	w: number,
	h: number,
	fallbackElements?: CanvasElement[]
): string[] {
	if (index) {
		const json = index.query_rect(x, y, w, h);
		try {
			return JSON.parse(json);
		} catch {
			return [];
		}
	}

	// JS fallback
	if (!fallbackElements) return [];
	return fallbackElements
		.filter((el) => {
			if (!el.visible || el.locked) return false;
			return el.x < x + w && el.x + el.width > x && el.y < y + h && el.y + el.height > y;
		})
		.map((el) => el.id);
}

/**
 * Find the nearest element to a point.
 *
 * Returns the element ID, or null if empty.
 */
export function nearest(x: number, y: number): string | null {
	if (index) {
		const id = index.nearest(x, y);
		return id || null;
	}
	return null;
}

/** Number of elements in the index. */
export function size(): number {
	if (index) return index.size();
	return 0;
}
