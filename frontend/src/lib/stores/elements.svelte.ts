/**
 * Element store using Svelte 5 runes ($state).
 *
 * Single source of truth for all canvas elements.
 * Local mutations happen optimistically during drag (no API calls).
 * Remote deltas from Phoenix are applied via applyRemoteDelta().
 *
 * ## WASM Integration
 *
 * Every mutation syncs with the wasm-spatial R-tree index (when loaded).
 * This gives O(log n) hit testing instead of linear scan.
 *
 * A sorted cache avoids re-sorting on every render — it's only rebuilt
 * when the element list changes structurally (add/remove/z_index change).
 *
 * Bug fix: applyRemoteDelta() now skips position/size fields when an element
 * is being actively dragged, preventing the race condition where a stale
 * server position overwrites the user's in-progress drag.
 */
import type { CanvasElement, ElementDelta } from '$lib/types/element';
import * as spatial from '$lib/wasm/spatial';

/** Reactive element map — keyed by element ID for O(1) lookups */
let elements = $state<Map<string, CanvasElement>>(new Map());

/**
 * Track which element is being actively dragged/resized.
 * Set by Canvas.svelte during drag, checked by applyRemoteDelta.
 */
let activeDragId = $state<string | null>(null);

/** Fields that should NOT be overwritten during an active drag */
const DRAG_GUARDED_FIELDS = new Set(['x', 'y', 'width', 'height']);

/** Cached sorted array — rebuilt only when dirty */
let sortedCache: CanvasElement[] | null = null;
let sortedDirty = true;

/** Mark the sorted cache as needing rebuild */
function invalidateSortedCache(): void {
	sortedCache = null;
	sortedDirty = true;
}

/** Sync a single element to the spatial index */
function syncToSpatial(el: CanvasElement): void {
	if (spatial.isLoaded()) {
		spatial.upsert(el);
	}
}

/** Bulk sync all elements to the spatial index */
function syncAllToSpatial(): void {
	if (spatial.isLoaded()) {
		spatial.bulkLoad(Array.from(elements.values()));
	}
}

export function setActiveDragId(id: string | null): void {
	activeDragId = id;
}

export function getActiveDragId(): string | null {
	return activeDragId;
}

/** Sorted by z_index for rendering order — uses cache to avoid re-sorting */
export function getElementsSorted(): CanvasElement[] {
	if (sortedDirty || sortedCache === null) {
		sortedCache = Array.from(elements.values()).sort((a, b) => a.z_index - b.z_index);
		sortedDirty = false;
	}
	return sortedCache;
}

export function getElementById(id: string): CanvasElement | undefined {
	return elements.get(id);
}

export function getAllElements(): Map<string, CanvasElement> {
	return elements;
}

/** Load all elements from Rails API (initial page load) */
export function setElements(els: CanvasElement[]): void {
	const map = new Map<string, CanvasElement>();
	for (const el of els) {
		map.set(el.id, el);
	}
	elements = map;
	invalidateSortedCache();
	syncAllToSpatial();
}

/** Optimistic local update — used during drag for instant feedback */
export function updateElement(id: string, updates: Partial<CanvasElement>): void {
	const existing = elements.get(id);
	if (!existing) return;
	const updated = { ...existing, ...updates };
	const next = new Map(elements);
	next.set(id, updated);
	elements = next;

	// Only invalidate sorted cache if z_index changed
	if ('z_index' in updates) {
		invalidateSortedCache();
	} else {
		// Position/size change — update cache in-place if available
		if (sortedCache) {
			const idx = sortedCache.findIndex((e) => e.id === id);
			if (idx >= 0) sortedCache[idx] = updated;
		}
	}

	syncToSpatial(updated);
}

/** Add a new element (from API response or local creation) */
export function addElement(el: CanvasElement): void {
	const next = new Map(elements);
	next.set(el.id, el);
	elements = next;
	invalidateSortedCache();
	syncToSpatial(el);
}

/** Remove an element */
export function removeElement(id: string): void {
	const next = new Map(elements);
	next.delete(id);
	elements = next;
	invalidateSortedCache();
	if (spatial.isLoaded()) {
		spatial.remove(id);
	}
}

/**
 * Apply a remote delta from the Go diff engine (via Phoenix broadcast).
 *
 * Race condition fix: if the delta targets the element currently being
 * dragged, skip x/y/width/height fields to prevent jitter.
 */
export function applyRemoteDelta(delta: ElementDelta): void {
	const existing = elements.get(delta.id);
	if (!existing) return;

	const updates: Partial<CanvasElement> = {};
	const isDragging = activeDragId === delta.id;

	for (const [field, change] of Object.entries(delta.changes)) {
		// Skip position/size fields during active drag to prevent race condition
		if (isDragging && DRAG_GUARDED_FIELDS.has(field)) {
			continue;
		}
		(updates as Record<string, unknown>)[field] = change.to;
	}

	// If all fields were skipped, no update needed
	if (Object.keys(updates).length === 0) return;

	const updated = { ...existing, ...updates };
	const next = new Map(elements);
	next.set(delta.id, updated);
	elements = next;
	invalidateSortedCache();
	syncToSpatial(updated);
}

/** Batch replace elements (e.g., after reorder) */
export function batchUpdateElements(updated: CanvasElement[]): void {
	const next = new Map(elements);
	for (const el of updated) {
		next.set(el.id, el);
	}
	elements = next;
	invalidateSortedCache();
	syncAllToSpatial();
}

/** Get the next available z_index */
export function getNextZIndex(): number {
	let max = 0;
	for (const el of elements.values()) {
		if (el.z_index > max) max = el.z_index;
	}
	return max + 1;
}
