/**
 * wasm-geom TypeScript wrapper — coordinate transforms and geometry.
 *
 * Every function has an inline JS fallback. When the WASM module is loaded,
 * calls are delegated to Rust for better performance (especially batch ops).
 * When WASM isn't available, the JS fallback provides identical behavior.
 *
 * Usage:
 *   import { screenToCanvas, batchCanvasToScreen } from '$lib/wasm/geom';
 *   const [cx, cy] = screenToCanvas(mouseX, mouseY, zoom, panX, panY);
 */

import { isModuleLoaded } from './loader';

// Lazy reference to the WASM module (loaded on first use)
let wasmGeom: typeof import('wasm-geom') | null = null;

async function getWasm(): Promise<typeof import('wasm-geom') | null> {
	if (wasmGeom) return wasmGeom;
	if (!isModuleLoaded('geom')) return null;
	try {
		wasmGeom = await import('wasm-geom');
		return wasmGeom;
	} catch {
		return null;
	}
}

// Eagerly try to load on module init (non-blocking)
getWasm();

/** Check if the WASM geom module is ready. */
export function isLoaded(): boolean {
	return wasmGeom !== null;
}

// ── Single-point transforms ──────────────────────────────────────────

export function screenToCanvas(
	sx: number, sy: number,
	zoom: number, panX: number, panY: number
): [number, number] {
	if (wasmGeom) {
		const r = wasmGeom.screen_to_canvas(sx, sy, zoom, panX, panY);
		return [r[0], r[1]];
	}
	return [(sx - panX) / zoom, (sy - panY) / zoom];
}

export function canvasToScreen(
	cx: number, cy: number,
	zoom: number, panX: number, panY: number
): [number, number] {
	if (wasmGeom) {
		const r = wasmGeom.canvas_to_screen(cx, cy, zoom, panX, panY);
		return [r[0], r[1]];
	}
	return [cx * zoom + panX, cy * zoom + panY];
}

// ── Batch transforms ─────────────────────────────────────────────────

export function batchCanvasToScreen(
	coords: Float64Array | number[],
	zoom: number, panX: number, panY: number
): Float64Array {
	if (wasmGeom) {
		const result = wasmGeom.batch_canvas_to_screen(
			coords instanceof Float64Array ? coords : new Float64Array(coords),
			zoom, panX, panY
		);
		return new Float64Array(result);
	}

	// JS fallback
	const out = new Float64Array(coords.length);
	for (let i = 0; i < coords.length; i += 2) {
		out[i] = coords[i] * zoom + panX;
		out[i + 1] = coords[i + 1] * zoom + panY;
	}
	return out;
}

export function batchScreenToCanvas(
	coords: Float64Array | number[],
	zoom: number, panX: number, panY: number
): Float64Array {
	if (wasmGeom) {
		const result = wasmGeom.batch_screen_to_canvas(
			coords instanceof Float64Array ? coords : new Float64Array(coords),
			zoom, panX, panY
		);
		return new Float64Array(result);
	}

	const out = new Float64Array(coords.length);
	for (let i = 0; i < coords.length; i += 2) {
		out[i] = (coords[i] - panX) / zoom;
		out[i + 1] = (coords[i + 1] - panY) / zoom;
	}
	return out;
}

// ── Grid snapping ────────────────────────────────────────────────────

export function snapToGrid(value: number, gridSize: number): number {
	if (wasmGeom) return wasmGeom.snap_to_grid(value, gridSize);
	if (gridSize <= 0) return value;
	return Math.round(value / gridSize) * gridSize;
}

export function batchSnapToGrid(values: number[], gridSize: number): Float64Array {
	if (wasmGeom) {
		return new Float64Array(wasmGeom.batch_snap_to_grid(new Float64Array(values), gridSize));
	}
	if (gridSize <= 0) return new Float64Array(values);
	return new Float64Array(values.map((v) => Math.round(v / gridSize) * gridSize));
}

// ── Geometry tests ───────────────────────────────────────────────────

export function pointInRect(
	px: number, py: number,
	rx: number, ry: number, rw: number, rh: number
): boolean {
	if (wasmGeom) return wasmGeom.point_in_rect(px, py, rx, ry, rw, rh);
	return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function rectsIntersect(
	ax: number, ay: number, aw: number, ah: number,
	bx: number, by: number, bw: number, bh: number
): boolean {
	if (wasmGeom) return wasmGeom.rects_intersect(ax, ay, aw, ah, bx, by, bw, bh);
	return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── Selection handles ────────────────────────────────────────────────

/**
 * Compute all 8 handle positions in screen-space.
 *
 * Returns 16 numbers: [nw_x, nw_y, n_x, n_y, ..., w_x, w_y]
 * Order: nw, n, ne, e, se, s, sw, w
 */
export function computeHandles(
	x: number, y: number, w: number, h: number,
	zoom: number, panX: number, panY: number
): number[] {
	if (wasmGeom) {
		return Array.from(wasmGeom.compute_handles(x, y, w, h, zoom, panX, panY));
	}

	const sx = x * zoom + panX;
	const sy = y * zoom + panY;
	const sw = w * zoom;
	const sh = h * zoom;

	return [
		sx, sy,                  // nw
		sx + sw / 2, sy,         // n
		sx + sw, sy,             // ne
		sx + sw, sy + sh / 2,    // e
		sx + sw, sy + sh,        // se
		sx + sw / 2, sy + sh,    // s
		sx, sy + sh,             // sw
		sx, sy + sh / 2,         // w
	];
}

// ── Resize logic ─────────────────────────────────────────────────────

/** Handle index map matching the Rust enum. */
const HANDLE_MAP: Record<string, number> = {
	nw: 0, n: 1, ne: 2, e: 3, se: 4, s: 5, sw: 6, w: 7
};

export function resizeFromHandle(
	origX: number, origY: number, origW: number, origH: number,
	handle: string, dx: number, dy: number, minSize: number
): [number, number, number, number] {
	if (wasmGeom) {
		const idx = HANDLE_MAP[handle] ?? 0;
		const r = wasmGeom.resize_from_handle(origX, origY, origW, origH, idx, dx, dy, minSize);
		return [r[0], r[1], r[2], r[3]];
	}

	// JS fallback (matches geometry.ts logic)
	let x = origX, y = origY, w = origW, h = origH;

	switch (handle) {
		case 'nw': x += dx; y += dy; w -= dx; h -= dy; break;
		case 'n': y += dy; h -= dy; break;
		case 'ne': y += dy; w += dx; h -= dy; break;
		case 'e': w += dx; break;
		case 'se': w += dx; h += dy; break;
		case 's': h += dy; break;
		case 'sw': x += dx; w -= dx; h += dy; break;
		case 'w': x += dx; w -= dx; break;
	}

	if (w < minSize) {
		if (handle.includes('w')) x = origX + origW - minSize;
		w = minSize;
	}
	if (h < minSize) {
		if (handle.includes('n')) y = origY + origH - minSize;
		h = minSize;
	}

	return [x, y, w, h];
}
