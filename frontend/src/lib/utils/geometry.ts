/**
 * Geometry utilities for canvas element manipulation.
 * All coordinates are in canvas-space (not screen-space).
 */

export interface Point {
	x: number;
	y: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** Check if a point is inside a rectangle */
export function pointInRect(point: Point, rect: Rect): boolean {
	return (
		point.x >= rect.x &&
		point.x <= rect.x + rect.width &&
		point.y >= rect.y &&
		point.y <= rect.y + rect.height
	);
}

/** Minimum element dimensions to prevent degenerate shapes */
export const MIN_SIZE = 20;

/**
 * Resize handle positions — 8 handles around the bounding box.
 * Each handle returns a cursor style and a resize function.
 */
export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLE_SIZE = 8;

export function getHandleCursor(handle: HandlePosition): string {
	const cursors: Record<HandlePosition, string> = {
		nw: 'nwse-resize',
		n: 'ns-resize',
		ne: 'nesw-resize',
		e: 'ew-resize',
		se: 'nwse-resize',
		s: 'ns-resize',
		sw: 'nesw-resize',
		w: 'ew-resize'
	};
	return cursors[handle];
}

/**
 * Compute new rect after resizing from a specific handle.
 * Preserves minimum size constraints.
 */
export function resizeFromHandle(
	original: Rect,
	handle: HandlePosition,
	dx: number,
	dy: number
): Rect {
	let { x, y, width, height } = original;

	switch (handle) {
		case 'nw':
			x += dx;
			y += dy;
			width -= dx;
			height -= dy;
			break;
		case 'n':
			y += dy;
			height -= dy;
			break;
		case 'ne':
			y += dy;
			width += dx;
			height -= dy;
			break;
		case 'e':
			width += dx;
			break;
		case 'se':
			width += dx;
			height += dy;
			break;
		case 's':
			height += dy;
			break;
		case 'sw':
			x += dx;
			width -= dx;
			height += dy;
			break;
		case 'w':
			x += dx;
			width -= dx;
			break;
	}

	// Enforce minimum size
	if (width < MIN_SIZE) {
		if (handle.includes('w')) x = original.x + original.width - MIN_SIZE;
		width = MIN_SIZE;
	}
	if (height < MIN_SIZE) {
		if (handle.includes('n')) y = original.y + original.height - MIN_SIZE;
		height = MIN_SIZE;
	}

	return { x, y, width, height };
}
