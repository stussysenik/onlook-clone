/**
 * Type declarations for WASM modules built by wasm-pack.
 *
 * These provide TypeScript types for the Rust functions exposed via wasm-bindgen.
 * The actual modules are built from the wasm/ workspace and resolved by
 * the Vite wasm-pack plugin.
 */

declare module 'wasm-geom' {
	export function screen_to_canvas(sx: number, sy: number, zoom: number, pan_x: number, pan_y: number): Float64Array;
	export function canvas_to_screen(cx: number, cy: number, zoom: number, pan_x: number, pan_y: number): Float64Array;
	export function batch_canvas_to_screen(coords: Float64Array, zoom: number, pan_x: number, pan_y: number): Float64Array;
	export function batch_screen_to_canvas(coords: Float64Array, zoom: number, pan_x: number, pan_y: number): Float64Array;
	export function snap_to_grid(value: number, grid_size: number): number;
	export function batch_snap_to_grid(values: Float64Array, grid_size: number): Float64Array;
	export function point_in_rect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean;
	export function rects_intersect(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean;
	export function compute_handles(x: number, y: number, w: number, h: number, zoom: number, pan_x: number, pan_y: number): Float64Array;
	export function resize_from_handle(orig_x: number, orig_y: number, orig_w: number, orig_h: number, handle: number, dx: number, dy: number, min_size: number): Float64Array;
}

declare module 'wasm-spatial' {
	export class SpatialIndex {
		constructor();
		bulk_load(json: string): void;
		upsert(id: string, x: number, y: number, w: number, h: number, z_index: number, visible: boolean, locked: boolean): void;
		remove(id: string): void;
		hit_test(x: number, y: number): string;
		query_rect(x: number, y: number, w: number, h: number): string;
		nearest(x: number, y: number): string;
		size(): number;
	}
}

declare module 'wasm-diff' {
	export function compute_delta(prev_json: string, curr_json: string): string;
	export function batch_compute_deltas(pairs_json: string): string;
}

declare module 'wasm-render' {
	export function pack_elements(json: string): Float32Array;
	export function pack_viewport(zoom: number, pan_x: number, pan_y: number, screen_width: number, screen_height: number): Float32Array;
	export function pack_grid(grid_size: number, show: boolean, dot_opacity: number): Float32Array;
	export function floats_per_element(): number;
	export function parse_hex_color(hex: string): Float32Array;
}

// Allow importing WGSL files as raw strings
declare module '*.wgsl?raw' {
	const content: string;
	export default content;
}
