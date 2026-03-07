/**
 * Viewport store — tracks zoom level, pan offset, and active tool mode.
 *
 * The viewport transform converts between canvas-space and screen-space:
 *   screenX = canvasX * zoom + panX
 *   screenY = canvasY * zoom + panY
 *
 * Tool modes determine how pointer events are interpreted:
 *   - "select" — click to select, drag to move
 *   - "insert" — click to place a new element
 *   - "pan"    — drag to pan the canvas (middle-click always pans)
 *
 * When the wasm-geom module is loaded, coordinate transforms and grid
 * snapping are delegated to Rust/WASM for better batch performance.
 * The API is identical — callers don't need to know about WASM.
 */

import * as wasmGeom from '$lib/wasm/geom';

export type ToolMode = 'select' | 'insert' | 'pan';

/** Zoom level (1.0 = 100%) */
let zoom = $state(1);

/** Pan offset in screen pixels */
let panX = $state(0);
let panY = $state(0);

/** Current tool mode */
let toolMode = $state<ToolMode>('select');

/** Grid snap size (0 = disabled) */
let gridSize = $state(20);

/** Whether to show the grid */
let showGrid = $state(true);

// --- Zoom ---

export function getZoom(): number {
	return zoom;
}

export function setZoom(z: number): void {
	zoom = Math.max(0.1, Math.min(5, z));
}

/** Zoom toward a point (used for scroll-to-zoom) */
export function zoomToward(delta: number, screenX: number, screenY: number): void {
	const factor = delta > 0 ? 0.9 : 1.1;
	const newZoom = Math.max(0.1, Math.min(5, zoom * factor));

	// Adjust pan so the point under the cursor stays fixed
	panX = screenX - (screenX - panX) * (newZoom / zoom);
	panY = screenY - (screenY - panY) * (newZoom / zoom);
	zoom = newZoom;
}

// --- Pan ---

export function getPan(): { x: number; y: number } {
	return { x: panX, y: panY };
}

export function setPan(x: number, y: number): void {
	panX = x;
	panY = y;
}

export function panBy(dx: number, dy: number): void {
	panX += dx;
	panY += dy;
}

// --- Tool Mode ---

export function getToolMode(): ToolMode {
	return toolMode;
}

export function setToolMode(mode: ToolMode): void {
	toolMode = mode;
}

// --- Grid ---

export function getGridSize(): number {
	return gridSize;
}

export function setGridSize(size: number): void {
	gridSize = size;
}

export function getShowGrid(): boolean {
	return showGrid;
}

export function setShowGrid(show: boolean): void {
	showGrid = show;
}

/** Snap a value to the nearest grid line (delegates to WASM when loaded) */
export function snapToGrid(value: number): number {
	if (gridSize <= 0) return value;
	if (wasmGeom.isLoaded()) {
		return wasmGeom.snapToGrid(value, gridSize);
	}
	return Math.round(value / gridSize) * gridSize;
}

// --- Coordinate transforms ---

/** Convert screen coordinates to canvas coordinates (delegates to WASM when loaded) */
export function screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
	if (wasmGeom.isLoaded()) {
		const [x, y] = wasmGeom.screenToCanvas(screenX, screenY, zoom, panX, panY);
		return { x, y };
	}
	return {
		x: (screenX - panX) / zoom,
		y: (screenY - panY) / zoom
	};
}

/** Convert canvas coordinates to screen coordinates (delegates to WASM when loaded) */
export function canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
	if (wasmGeom.isLoaded()) {
		const [x, y] = wasmGeom.canvasToScreen(canvasX, canvasY, zoom, panX, panY);
		return { x, y };
	}
	return {
		x: canvasX * zoom + panX,
		y: canvasY * zoom + panY
	};
}

/** Reset viewport to default */
export function resetViewport(): void {
	zoom = 1;
	panX = 0;
	panY = 0;
}
