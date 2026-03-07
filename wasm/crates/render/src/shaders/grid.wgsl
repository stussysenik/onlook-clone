// grid.wgsl — Full-screen dot grid via fragment shader.
//
// Renders a repeating dot pattern that responds to viewport zoom and pan.
// Auto-hides when the grid spacing is too small (zoomed out past threshold).

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

struct GridParams {
    grid_size: f32,
    show: f32,       // 0.0 or 1.0
    dot_opacity: f32,
    _pad: f32,
};

@group(0) @binding(0) var<uniform> viewport: Viewport;
@group(0) @binding(1) var<uniform> grid: GridParams;

// ── Vertex output ────────────────────────────────────────────────────

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) screen_pos: vec2<f32>,
};

// Full-screen triangle (3 vertices that cover the entire viewport)
const FULLSCREEN_TRI = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
);

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
    let pos = FULLSCREEN_TRI[vid];

    var out: VertexOutput;
    out.position = vec4<f32>(pos, 0.0, 1.0);

    // Convert NDC → screen pixels
    out.screen_pos = vec2<f32>(
        (pos.x * 0.5 + 0.5) * viewport.screen_width,
        (0.5 - pos.y * 0.5) * viewport.screen_height,
    );

    return out;
}

// ── Fragment shader ──────────────────────────────────────────────────

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Early out if grid is hidden
    if grid.show < 0.5 {
        discard;
    }

    // Grid spacing in screen pixels
    let spacing = grid.grid_size * viewport.zoom;

    // Auto-hide when dots would be too dense (< 8px apart)
    if spacing < 8.0 {
        discard;
    }

    // Compute distance to nearest grid intersection
    let grid_x = in.screen_pos.x - viewport.pan_x;
    let grid_y = in.screen_pos.y - viewport.pan_y;

    // Fractional position within grid cell
    let fx = grid_x - floor(grid_x / spacing) * spacing;
    let fy = grid_y - floor(grid_y / spacing) * spacing;

    // Distance from nearest grid point
    let dx = min(fx, spacing - fx);
    let dy = min(fy, spacing - fy);
    let dist = length(vec2<f32>(dx, dy));

    // Dot radius (1.0px)
    let dot_radius = 1.0;

    // Anti-aliased dot
    let alpha = 1.0 - smoothstep(dot_radius - 0.5, dot_radius + 0.5, dist);

    if alpha < 0.001 {
        discard;
    }

    // Zinc-600 color with configurable opacity
    let dot_color = vec3<f32>(0.392, 0.392, 0.435);
    return vec4<f32>(dot_color, alpha * grid.dot_opacity);
}
