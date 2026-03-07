//! wasm-render — WebGPU data packing for instanced element rendering.
//!
//! ## Hybrid Architecture
//!
//! The WebGPU API calls (device creation, pipeline setup, draw calls) happen
//! in TypeScript because the `web-sys` WebGPU bindings are unstable. Rust's
//! job is the compute-heavy part: packing element data into GPU-aligned buffers.
//!
//! ## Buffer Layout
//!
//! Each element is packed into a struct of 16 f32 values (64 bytes, aligned):
//!
//! ```text
//! [0]  x            (canvas-space)
//! [1]  y
//! [2]  width
//! [3]  height
//! [4]  rotation     (radians)
//! [5]  border_radius
//! [6]  opacity
//! [7]  z_index      (as f32)
//! [8]  bg_r         (0.0–1.0)
//! [9]  bg_g
//! [10] bg_b
//! [11] bg_a
//! [12] border_width
//! [13] border_r
//! [14] border_g
//! [15] flags        (bitfield: 1=visible, 2=selected, 4=locked)
//! ```

use serde::Deserialize;
use wasm_bindgen::prelude::*;

/// Per-element input from JavaScript.
#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct ElementData {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
    z_index: i32,
    visible: bool,
    locked: bool,
    selected: bool,
    #[serde(default)]
    bg_r: f64,
    #[serde(default)]
    bg_g: f64,
    #[serde(default)]
    bg_b: f64,
    #[serde(default = "default_one")]
    bg_a: f64,
    #[serde(default)]
    border_radius: f64,
    #[serde(default)]
    border_width: f64,
    #[serde(default)]
    border_r: f64,
    #[serde(default)]
    border_g: f64,
    #[serde(default)]
    border_b: f64,
}

fn default_one() -> f64 {
    1.0
}

/// Floats per element in the GPU buffer.
const FLOATS_PER_ELEMENT: usize = 16;

/// Pack element data into a Float32Array-compatible buffer.
///
/// Input: JSON array of element objects.
/// Output: Vec<f32> ready to be written to a GPU storage buffer.
///
/// Invisible elements get z_index = -2 so the vertex shader clips them.
#[wasm_bindgen]
pub fn pack_elements(json: &str) -> Vec<f32> {
    let elements: Vec<ElementData> = match serde_json::from_str(json) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut buf = Vec::with_capacity(elements.len() * FLOATS_PER_ELEMENT);

    for el in &elements {
        let flags: u32 = if el.visible { 1 } else { 0 }
            | if el.selected { 2 } else { 0 }
            | if el.locked { 4 } else { 0 };

        buf.push(el.x as f32);
        buf.push(el.y as f32);
        buf.push(el.width as f32);
        buf.push(el.height as f32);
        buf.push(el.rotation as f32);
        buf.push(el.border_radius as f32);
        buf.push(if el.visible { el.bg_a as f32 } else { 0.0 });
        buf.push(if el.visible { el.z_index as f32 } else { -2.0 });
        buf.push(el.bg_r as f32);
        buf.push(el.bg_g as f32);
        buf.push(el.bg_b as f32);
        buf.push(el.bg_a as f32);
        buf.push(el.border_width as f32);
        buf.push(el.border_r as f32);
        buf.push(el.border_g as f32);
        buf.push(f32::from_bits(flags));
    }

    buf
}

/// Pack viewport uniform data.
///
/// Returns 8 f32 values (padded to 32 bytes for GPU alignment):
/// [zoom, pan_x, pan_y, screen_width, screen_height, 0, 0, 0]
#[wasm_bindgen]
pub fn pack_viewport(
    zoom: f64,
    pan_x: f64,
    pan_y: f64,
    screen_width: f64,
    screen_height: f64,
) -> Vec<f32> {
    vec![
        zoom as f32,
        pan_x as f32,
        pan_y as f32,
        screen_width as f32,
        screen_height as f32,
        0.0,
        0.0,
        0.0,
    ]
}

/// Pack grid uniform data.
///
/// Returns 4 f32 values (16 bytes):
/// [grid_size, show (0 or 1), dot_opacity, 0]
#[wasm_bindgen]
pub fn pack_grid(grid_size: f64, show: bool, dot_opacity: f64) -> Vec<f32> {
    vec![
        grid_size as f32,
        if show { 1.0 } else { 0.0 },
        dot_opacity as f32,
        0.0,
    ]
}

/// Returns the number of f32 values per element (for buffer stride calculation).
#[wasm_bindgen]
pub fn floats_per_element() -> usize {
    FLOATS_PER_ELEMENT
}

/// Parse a CSS hex color (#RRGGBB or #RGB) into [r, g, b] in 0.0–1.0 range.
#[wasm_bindgen]
pub fn parse_hex_color(hex: &str) -> Vec<f32> {
    let hex = hex.trim_start_matches('#');
    match hex.len() {
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(0) as f32 / 255.0;
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(0) as f32 / 255.0;
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(0) as f32 / 255.0;
            vec![r, g, b]
        }
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).unwrap_or(0) as f32 / 255.0;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).unwrap_or(0) as f32 / 255.0;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).unwrap_or(0) as f32 / 255.0;
            vec![r, g, b]
        }
        _ => vec![0.0, 0.0, 0.0],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_viewport() {
        let buf = pack_viewport(2.0, 100.0, 50.0, 1920.0, 1080.0);
        assert_eq!(buf.len(), 8);
        assert_eq!(buf[0], 2.0);
        assert_eq!(buf[1], 100.0);
    }

    #[test]
    fn test_parse_hex_color() {
        let rgb = parse_hex_color("#ff0000");
        assert!((rgb[0] - 1.0).abs() < 0.01);
        assert!(rgb[1].abs() < 0.01);
        assert!(rgb[2].abs() < 0.01);
    }

    #[test]
    fn test_parse_hex_short() {
        let rgb = parse_hex_color("#f00");
        assert!((rgb[0] - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_pack_elements() {
        let json = r#"[{
            "x": 10, "y": 20, "width": 100, "height": 50,
            "rotation": 0, "z_index": 1, "visible": true, "locked": false,
            "selected": false, "bg_r": 1.0, "bg_g": 0.0, "bg_b": 0.0,
            "bg_a": 1.0, "border_radius": 4, "border_width": 0,
            "border_r": 0, "border_g": 0, "border_b": 0
        }]"#;
        let buf = pack_elements(json);
        assert_eq!(buf.len(), FLOATS_PER_ELEMENT);
        assert_eq!(buf[0], 10.0); // x
        assert_eq!(buf[1], 20.0); // y
    }
}
