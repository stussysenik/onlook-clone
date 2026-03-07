//! wasm-geom — Pure math for canvas coordinate transforms and geometry.
//!
//! This crate has zero dependencies beyond wasm-bindgen. Every function is a
//! pure computation with no allocations on the hot path (except batch ops).
//!
//! ## Coordinate Spaces
//!
//! Canvas-space: the infinite 2D plane where elements live.
//! Screen-space:  pixel coordinates on the user's display.
//!
//! The transform is:
//!   screen = canvas * zoom + pan
//!   canvas = (screen - pan) / zoom

use wasm_bindgen::prelude::*;

// ── Single-point transforms ──────────────────────────────────────────

/// Convert screen coordinates → canvas coordinates.
///
/// Formula: canvas = (screen - pan) / zoom
#[wasm_bindgen]
pub fn screen_to_canvas(sx: f64, sy: f64, zoom: f64, pan_x: f64, pan_y: f64) -> Vec<f64> {
    vec![(sx - pan_x) / zoom, (sy - pan_y) / zoom]
}

/// Convert canvas coordinates → screen coordinates.
///
/// Formula: screen = canvas * zoom + pan
#[wasm_bindgen]
pub fn canvas_to_screen(cx: f64, cy: f64, zoom: f64, pan_x: f64, pan_y: f64) -> Vec<f64> {
    vec![cx * zoom + pan_x, cy * zoom + pan_y]
}

// ── Batch transforms (interleaved x,y pairs) ────────────────────────

/// Batch convert canvas → screen for N points.
///
/// Input: interleaved [x0, y0, x1, y1, ...] in canvas-space.
/// Output: interleaved [sx0, sy0, sx1, sy1, ...] in screen-space.
///
/// This is ~10x faster than N individual calls across the WASM boundary.
#[wasm_bindgen]
pub fn batch_canvas_to_screen(
    coords: &[f64],
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
) -> Vec<f64> {
    let mut out = Vec::with_capacity(coords.len());
    let mut i = 0;
    while i + 1 < coords.len() {
        out.push(coords[i] * zoom + pan_x);
        out.push(coords[i + 1] * zoom + pan_y);
        i += 2;
    }
    out
}

/// Batch convert screen → canvas for N points.
///
/// Input: interleaved [sx0, sy0, sx1, sy1, ...] in screen-space.
/// Output: interleaved [cx0, cy0, cx1, cy1, ...] in canvas-space.
#[wasm_bindgen]
pub fn batch_screen_to_canvas(
    coords: &[f64],
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
) -> Vec<f64> {
    let mut out = Vec::with_capacity(coords.len());
    let mut i = 0;
    while i + 1 < coords.len() {
        out.push((coords[i] - pan_x) / zoom);
        out.push((coords[i + 1] - pan_y) / zoom);
        i += 2;
    }
    out
}

// ── Grid snapping ────────────────────────────────────────────────────

/// Snap a single value to the nearest grid line.
///
/// Returns `value` unchanged if `grid_size` is zero or negative.
#[wasm_bindgen]
pub fn snap_to_grid(value: f64, grid_size: f64) -> f64 {
    if grid_size <= 0.0 {
        return value;
    }
    (value / grid_size).round() * grid_size
}

/// Batch snap N values to grid.
#[wasm_bindgen]
pub fn batch_snap_to_grid(values: &[f64], grid_size: f64) -> Vec<f64> {
    if grid_size <= 0.0 {
        return values.to_vec();
    }
    values
        .iter()
        .map(|v| (v / grid_size).round() * grid_size)
        .collect()
}

// ── Geometry tests ───────────────────────────────────────────────────

/// Test if point (px, py) is inside rectangle (rx, ry, rw, rh).
#[wasm_bindgen]
pub fn point_in_rect(px: f64, py: f64, rx: f64, ry: f64, rw: f64, rh: f64) -> bool {
    px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
}

/// Test if two axis-aligned rectangles intersect.
#[wasm_bindgen]
pub fn rects_intersect(
    ax: f64, ay: f64, aw: f64, ah: f64,
    bx: f64, by: f64, bw: f64, bh: f64,
) -> bool {
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// ── Selection handles ────────────────────────────────────────────────

/// Compute all 8 resize handle positions in screen-space.
///
/// Returns 16 floats: [nw_x, nw_y, n_x, n_y, ne_x, ne_y, e_x, e_y,
///                      se_x, se_y, s_x, s_y, sw_x, sw_y, w_x, w_y]
///
/// Order matches the handle array: nw, n, ne, e, se, s, sw, w.
#[wasm_bindgen]
pub fn compute_handles(
    x: f64, y: f64, w: f64, h: f64,
    zoom: f64, pan_x: f64, pan_y: f64,
) -> Vec<f64> {
    let sx = x * zoom + pan_x;
    let sy = y * zoom + pan_y;
    let sw = w * zoom;
    let sh = h * zoom;

    vec![
        sx,            sy,             // nw
        sx + sw / 2.0, sy,             // n
        sx + sw,       sy,             // ne
        sx + sw,       sy + sh / 2.0,  // e
        sx + sw,       sy + sh,        // se
        sx + sw / 2.0, sy + sh,        // s
        sx,            sy + sh,        // sw
        sx,            sy + sh / 2.0,  // w
    ]
}

// ── Resize logic ─────────────────────────────────────────────────────

/// Compute new rectangle after resizing from a handle.
///
/// `handle`: 0=nw, 1=n, 2=ne, 3=e, 4=se, 5=s, 6=sw, 7=w
///
/// Returns [x, y, width, height] with minimum size enforced.
#[wasm_bindgen]
pub fn resize_from_handle(
    orig_x: f64, orig_y: f64, orig_w: f64, orig_h: f64,
    handle: u8,
    dx: f64, dy: f64,
    min_size: f64,
) -> Vec<f64> {
    let mut x = orig_x;
    let mut y = orig_y;
    let mut w = orig_w;
    let mut h = orig_h;

    match handle {
        0 => { // nw
            x += dx; y += dy; w -= dx; h -= dy;
        }
        1 => { // n
            y += dy; h -= dy;
        }
        2 => { // ne
            y += dy; w += dx; h -= dy;
        }
        3 => { // e
            w += dx;
        }
        4 => { // se
            w += dx; h += dy;
        }
        5 => { // s
            h += dy;
        }
        6 => { // sw
            x += dx; w -= dx; h += dy;
        }
        7 => { // w
            x += dx; w -= dx;
        }
        _ => {}
    }

    // Enforce minimum size
    if w < min_size {
        if handle == 0 || handle == 6 || handle == 7 {
            x = orig_x + orig_w - min_size;
        }
        w = min_size;
    }
    if h < min_size {
        if handle == 0 || handle == 1 || handle == 2 {
            y = orig_y + orig_h - min_size;
        }
        h = min_size;
    }

    vec![x, y, w, h]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_canvas_roundtrip() {
        let zoom = 2.0;
        let pan_x = 100.0;
        let pan_y = 50.0;

        let screen = canvas_to_screen(50.0, 75.0, zoom, pan_x, pan_y);
        let canvas = screen_to_canvas(screen[0], screen[1], zoom, pan_x, pan_y);

        assert!((canvas[0] - 50.0).abs() < 1e-10);
        assert!((canvas[1] - 75.0).abs() < 1e-10);
    }

    #[test]
    fn test_snap_to_grid() {
        assert_eq!(snap_to_grid(23.0, 20.0), 20.0);
        assert_eq!(snap_to_grid(31.0, 20.0), 40.0);
        assert_eq!(snap_to_grid(10.0, 0.0), 10.0); // disabled
    }

    #[test]
    fn test_point_in_rect() {
        assert!(point_in_rect(5.0, 5.0, 0.0, 0.0, 10.0, 10.0));
        assert!(!point_in_rect(15.0, 5.0, 0.0, 0.0, 10.0, 10.0));
    }

    #[test]
    fn test_rects_intersect() {
        assert!(rects_intersect(0.0, 0.0, 10.0, 10.0, 5.0, 5.0, 10.0, 10.0));
        assert!(!rects_intersect(0.0, 0.0, 10.0, 10.0, 20.0, 20.0, 10.0, 10.0));
    }

    #[test]
    fn test_resize_from_handle_min_size() {
        let result = resize_from_handle(0.0, 0.0, 100.0, 100.0, 4, -200.0, -200.0, 20.0);
        assert!(result[2] >= 20.0); // width >= min
        assert!(result[3] >= 20.0); // height >= min
    }
}
