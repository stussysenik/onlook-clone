// element.wgsl — Instanced rounded-rect rendering via SDF.
//
// Each canvas element is rendered as a quad (2 triangles, 6 vertices).
// The vertex shader transforms from canvas-space → screen-space → NDC.
// The fragment shader uses a signed distance function (SDF) for:
//   - Rounded corners (border_radius)
//   - Anti-aliased edges
//   - Border rendering
//   - Selection outline (blue ring)

// ── Uniforms ─────────────────────────────────────────────────────────

struct Viewport {
    zoom: f32,
    pan_x: f32,
    pan_y: f32,
    screen_width: f32,
    screen_height: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
};

@group(0) @binding(0) var<uniform> viewport: Viewport;

// ── Element storage buffer ───────────────────────────────────────────

struct Element {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    rotation: f32,
    border_radius: f32,
    opacity: f32,
    z_index: f32,
    bg_r: f32,
    bg_g: f32,
    bg_b: f32,
    bg_a: f32,
    border_width: f32,
    border_r: f32,
    border_g: f32,
    flags: f32,   // bitfield as f32: 1=visible, 2=selected, 4=locked
};

@group(0) @binding(1) var<storage, read> elements: array<Element>;

// ── Vertex output ────────────────────────────────────────────────────

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,               // 0..1 within the quad
    @location(1) size_px: vec2<f32>,           // element size in screen pixels
    @location(2) bg_color: vec4<f32>,
    @location(3) border_radius: f32,
    @location(4) border_width: f32,
    @location(5) border_color: vec3<f32>,
    @location(6) flags_f: f32,
};

// ── Vertex shader ────────────────────────────────────────────────────

// Unit quad vertices (2 triangles)
const QUAD_POS = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0), vec2<f32>(1.0, 1.0), vec2<f32>(0.0, 1.0),
);

@vertex
fn vs_main(
    @builtin(vertex_index) vid: u32,
    @builtin(instance_index) iid: u32,
) -> VertexOutput {
    let el = elements[iid];
    let uv = QUAD_POS[vid];

    // Canvas → screen
    let screen_x = el.x * viewport.zoom + viewport.pan_x;
    let screen_y = el.y * viewport.zoom + viewport.pan_y;
    let screen_w = el.w * viewport.zoom;
    let screen_h = el.h * viewport.zoom;

    // Position within the quad
    let pos_screen = vec2<f32>(
        screen_x + uv.x * screen_w,
        screen_y + uv.y * screen_h,
    );

    // Screen → NDC  (y-down → y-up, 0..width → -1..1)
    let ndc = vec2<f32>(
        (pos_screen.x / viewport.screen_width) * 2.0 - 1.0,
        1.0 - (pos_screen.y / viewport.screen_height) * 2.0,
    );

    // Clip invisible elements (z_index == -2)
    let z = select(0.0, -2.0, el.z_index < -1.0);

    var out: VertexOutput;
    out.position = vec4<f32>(ndc, z, 1.0);
    out.uv = uv;
    out.size_px = vec2<f32>(screen_w, screen_h);
    out.bg_color = vec4<f32>(el.bg_r, el.bg_g, el.bg_b, el.bg_a * el.opacity);
    out.border_radius = el.border_radius * viewport.zoom;
    out.border_width = el.border_width * viewport.zoom;
    out.border_color = vec3<f32>(el.border_r, el.border_g, el.border_g);
    out.flags_f = el.flags;

    return out;
}

// ── Fragment shader ──────────────────────────────────────────────────

/// SDF for a rounded rectangle centered at origin with half-extents `b` and corner radius `r`.
fn sdf_rounded_rect(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let q = abs(p) - b + vec2<f32>(r, r);
    return length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let size = in.size_px;
    let half = size * 0.5;

    // Map UV (0..1) to centered coordinates (-half..+half)
    let p = (in.uv - 0.5) * size;

    // Clamp border_radius so it doesn't exceed half the smallest dimension
    let max_radius = min(half.x, half.y);
    let radius = min(in.border_radius, max_radius);

    // SDF distance
    let d = sdf_rounded_rect(p, half, radius);

    // Anti-aliased edge (1px feather)
    let aa = 1.0;
    let alpha = 1.0 - smoothstep(-aa, aa, d);

    if alpha < 0.001 {
        discard;
    }

    var color = in.bg_color;
    color.a *= alpha;

    // Border rendering
    if in.border_width > 0.0 {
        let inner_d = sdf_rounded_rect(p, half - vec2<f32>(in.border_width), max(radius - in.border_width, 0.0));
        let border_alpha = 1.0 - smoothstep(-aa, aa, inner_d);
        let is_border = alpha - border_alpha;

        if is_border > 0.01 {
            color = vec4<f32>(in.border_color, alpha);
        }
    }

    // Selection outline (blue ring, 2px outside the element)
    let flags_u = bitcast<u32>(in.flags_f);
    let is_selected = (flags_u & 2u) != 0u;
    if is_selected {
        let sel_width = 2.0;
        let outer_d = sdf_rounded_rect(p, half + vec2<f32>(sel_width), radius + sel_width);
        let sel_alpha = (1.0 - smoothstep(-aa, aa, outer_d)) - alpha;

        if sel_alpha > 0.01 {
            // Blue selection color
            color = vec4<f32>(0.259, 0.522, 0.957, sel_alpha);
        }
    }

    return color;
}
