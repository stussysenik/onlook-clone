/**
 * WebGPU Renderer — GPU-accelerated element rendering.
 *
 * Hybrid architecture:
 *   - Rust packs element data into GPU-aligned Float32Array buffers
 *   - TypeScript manages WebGPU API calls (device, pipelines, draw)
 *
 * This approach is more stable than using web-sys WebGPU bindings directly,
 * and lets us leverage TypeScript's excellent WebGPU type definitions.
 *
 * ## Render Pipeline
 *
 * 1. Grid pass: full-screen triangle with dot grid fragment shader
 * 2. Element pass: instanced quads with SDF rounded-rect fragment shader
 */

import { isModuleLoaded } from './loader';
import type { CanvasElement } from '$lib/types/element';

// WGSL shaders are loaded lazily to avoid SSR issues with ?raw imports.
// They're only needed when WebGPU is actually used (client-side only).
let elementShaderSource: string | null = null;
let gridShaderSource: string | null = null;

async function loadShaders(): Promise<boolean> {
	try {
		const [elMod, gridMod] = await Promise.all([
			import('./shaders/element.wgsl?raw'),
			import('./shaders/grid.wgsl?raw')
		]);
		elementShaderSource = elMod.default;
		gridShaderSource = gridMod.default;
		return true;
	} catch (err) {
		console.warn('[WebGPU] Failed to load shaders:', err);
		return false;
	}
}

let wasmRender: typeof import('wasm-render') | null = null;

async function getWasm(): Promise<typeof import('wasm-render') | null> {
	if (wasmRender) return wasmRender;
	if (!isModuleLoaded('render')) return null;
	try {
		wasmRender = await import('wasm-render');
		return wasmRender;
	} catch {
		return null;
	}
}

getWasm();

/** Maximum pre-allocated element count. */
const MAX_ELEMENTS = 16384;

/**
 * WebGPU Renderer class.
 *
 * Manages the GPU device, pipelines, buffers, and render loop.
 * Use `WebGpuRenderer.create(canvas)` to construct.
 */
export class WebGpuRenderer {
	private device: GPUDevice;
	private context: GPUCanvasContext;
	private format: GPUTextureFormat;

	// Buffers
	private viewportBuffer: GPUBuffer;
	private gridBuffer: GPUBuffer;
	private elementBuffer: GPUBuffer;

	// Pipelines
	private gridPipeline: GPURenderPipeline;
	private elementPipeline: GPURenderPipeline;

	// Bind groups
	private gridBindGroup: GPUBindGroup;
	private elementBindGroup: GPUBindGroup;

	// State
	private elementCount = 0;

	private constructor(
		device: GPUDevice,
		context: GPUCanvasContext,
		format: GPUTextureFormat,
		viewportBuffer: GPUBuffer,
		gridBuffer: GPUBuffer,
		elementBuffer: GPUBuffer,
		gridPipeline: GPURenderPipeline,
		elementPipeline: GPURenderPipeline,
		gridBindGroup: GPUBindGroup,
		elementBindGroup: GPUBindGroup
	) {
		this.device = device;
		this.context = context;
		this.format = format;
		this.viewportBuffer = viewportBuffer;
		this.gridBuffer = gridBuffer;
		this.elementBuffer = elementBuffer;
		this.gridPipeline = gridPipeline;
		this.elementPipeline = elementPipeline;
		this.gridBindGroup = gridBindGroup;
		this.elementBindGroup = elementBindGroup;
	}

	/** Feature detection: can this browser use WebGPU? */
	static isSupported(): boolean {
		return typeof navigator !== 'undefined' && 'gpu' in navigator;
	}

	/** Async factory — creates device, pipelines, buffers. */
	static async create(canvas: HTMLCanvasElement): Promise<WebGpuRenderer | null> {
		if (!WebGpuRenderer.isSupported()) return null;

		// Load shaders lazily (avoids SSR issues)
		if (!elementShaderSource || !gridShaderSource) {
			const loaded = await loadShaders();
			if (!loaded || !elementShaderSource || !gridShaderSource) return null;
		}

		try {
			const adapter = await navigator.gpu.requestAdapter();
			if (!adapter) return null;

			const device = await adapter.requestDevice();
			const context = canvas.getContext('webgpu');
			if (!context) return null;

			const format = navigator.gpu.getPreferredCanvasFormat();
			context.configure({ device, format, alphaMode: 'premultiplied' });

			// ── Buffers ──
			const viewportBuffer = device.createBuffer({
				size: 32, // 8 × f32
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});

			const gridBuffer = device.createBuffer({
				size: 16, // 4 × f32
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			});

			const elementBuffer = device.createBuffer({
				size: MAX_ELEMENTS * 16 * 4, // 16 f32 per element
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			});

			// ── Grid pipeline ──
			const gridShader = device.createShaderModule({ code: gridShaderSource });
			const gridBindGroupLayout = device.createBindGroupLayout({
				entries: [
					{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
					{ binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
				]
			});

			const gridPipeline = device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [gridBindGroupLayout] }),
				vertex: { module: gridShader, entryPoint: 'vs_main' },
				fragment: {
					module: gridShader,
					entryPoint: 'fs_main',
					targets: [{
						format,
						blend: {
							color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
							alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
						}
					}]
				},
				primitive: { topology: 'triangle-list' }
			});

			const gridBindGroup = device.createBindGroup({
				layout: gridBindGroupLayout,
				entries: [
					{ binding: 0, resource: { buffer: viewportBuffer } },
					{ binding: 1, resource: { buffer: gridBuffer } }
				]
			});

			// ── Element pipeline ──
			const elementShader = device.createShaderModule({ code: elementShaderSource });
			const elementBindGroupLayout = device.createBindGroupLayout({
				entries: [
					{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
					{ binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } }
				]
			});

			const elementPipeline = device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [elementBindGroupLayout] }),
				vertex: { module: elementShader, entryPoint: 'vs_main' },
				fragment: {
					module: elementShader,
					entryPoint: 'fs_main',
					targets: [{
						format,
						blend: {
							color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
							alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
						}
					}]
				},
				primitive: { topology: 'triangle-list' }
			});

			const elementBindGroup = device.createBindGroup({
				layout: elementBindGroupLayout,
				entries: [
					{ binding: 0, resource: { buffer: viewportBuffer } },
					{ binding: 1, resource: { buffer: elementBuffer } }
				]
			});

			return new WebGpuRenderer(
				device, context, format,
				viewportBuffer, gridBuffer, elementBuffer,
				gridPipeline, elementPipeline,
				gridBindGroup, elementBindGroup
			);
		} catch (err) {
			console.warn('[WebGPU] Failed to create renderer:', err);
			return null;
		}
	}

	/** Update viewport uniform buffer. */
	updateViewport(zoom: number, panX: number, panY: number): void {
		const canvas = this.context.canvas as HTMLCanvasElement;
		let data: Float32Array;

		if (wasmRender) {
			data = new Float32Array(wasmRender.pack_viewport(zoom, panX, panY, canvas.width, canvas.height));
		} else {
			data = new Float32Array([zoom, panX, panY, canvas.width, canvas.height, 0, 0, 0]);
		}

		this.device.queue.writeBuffer(this.viewportBuffer, 0, data);
	}

	/** Update grid uniform buffer. */
	updateGrid(gridSize: number, show: boolean, dotOpacity = 0.3): void {
		let data: Float32Array;

		if (wasmRender) {
			data = new Float32Array(wasmRender.pack_grid(gridSize, show, dotOpacity));
		} else {
			data = new Float32Array([gridSize, show ? 1 : 0, dotOpacity, 0]);
		}

		this.device.queue.writeBuffer(this.gridBuffer, 0, data);
	}

	/**
	 * Update element storage buffer.
	 *
	 * Packs all elements into a GPU-aligned Float32Array and writes it.
	 * Uses Rust pack_elements when available for better performance.
	 */
	updateElements(elements: CanvasElement[], selectedId: string | null): void {
		this.elementCount = elements.length;
		if (elements.length === 0) return;

		let data: Float32Array;

		if (wasmRender) {
			// Prepare element data for Rust packing
			const packData = elements.map((el) => {
				const bgColor = parseColor(el.styles.backgroundColor);
				const borderColor = parseColor(el.styles.borderColor);
				return {
					x: el.x,
					y: el.y,
					width: el.width,
					height: el.height,
					rotation: el.rotation,
					z_index: el.z_index,
					visible: el.visible,
					locked: el.locked,
					selected: el.id === selectedId,
					bg_r: bgColor[0],
					bg_g: bgColor[1],
					bg_b: bgColor[2],
					bg_a: el.styles.opacity ?? 1,
					border_radius: el.styles.borderRadius ?? 0,
					border_width: el.styles.borderWidth ?? 0,
					border_r: borderColor[0],
					border_g: borderColor[1],
					border_b: borderColor[2]
				};
			});
			data = new Float32Array(wasmRender.pack_elements(JSON.stringify(packData)));
		} else {
			// JS fallback
			data = new Float32Array(elements.length * 16);
			for (let i = 0; i < elements.length; i++) {
				const el = elements[i];
				const off = i * 16;
				const bgColor = parseColor(el.styles.backgroundColor);
				const borderColor = parseColor(el.styles.borderColor);
				const flags = (el.visible ? 1 : 0) | (el.id === selectedId ? 2 : 0) | (el.locked ? 4 : 0);

				data[off + 0] = el.x;
				data[off + 1] = el.y;
				data[off + 2] = el.width;
				data[off + 3] = el.height;
				data[off + 4] = el.rotation;
				data[off + 5] = el.styles.borderRadius ?? 0;
				data[off + 6] = el.visible ? (el.styles.opacity ?? 1) : 0;
				data[off + 7] = el.visible ? el.z_index : -2;
				data[off + 8] = bgColor[0];
				data[off + 9] = bgColor[1];
				data[off + 10] = bgColor[2];
				data[off + 11] = el.styles.opacity ?? 1;
				data[off + 12] = el.styles.borderWidth ?? 0;
				data[off + 13] = borderColor[0];
				data[off + 14] = borderColor[1];

				// Pack flags as f32 bit pattern
				const flagsView = new DataView(new ArrayBuffer(4));
				flagsView.setUint32(0, flags, true);
				data[off + 15] = flagsView.getFloat32(0, true);
			}
		}

		this.device.queue.writeBuffer(this.elementBuffer, 0, data);
	}

	/** Execute one frame: grid pass → element pass → submit. */
	render(): void {
		const textureView = this.context.getCurrentTexture().createView();

		const encoder = this.device.createCommandEncoder();

		const pass = encoder.beginRenderPass({
			colorAttachments: [{
				view: textureView,
				clearValue: { r: 0.043, g: 0.043, b: 0.051, a: 1 }, // zinc-950
				loadOp: 'clear',
				storeOp: 'store'
			}]
		});

		// Grid pass
		pass.setPipeline(this.gridPipeline);
		pass.setBindGroup(0, this.gridBindGroup);
		pass.draw(3); // full-screen triangle

		// Element pass
		if (this.elementCount > 0) {
			pass.setPipeline(this.elementPipeline);
			pass.setBindGroup(0, this.elementBindGroup);
			pass.draw(6, this.elementCount); // 6 verts per quad × N instances
		}

		pass.end();
		this.device.queue.submit([encoder.finish()]);
	}

	/** Clean up GPU resources. */
	destroy(): void {
		this.viewportBuffer.destroy();
		this.gridBuffer.destroy();
		this.elementBuffer.destroy();
		this.device.destroy();
	}
}

// ── Color parsing helper ─────────────────────────────────────────────

/**
 * Parse a CSS color string into [r, g, b] in 0.0–1.0 range.
 * Supports #hex and hsl() formats.
 */
function parseColor(color?: string): [number, number, number] {
	if (!color) return [0, 0, 0];

	// Hex color
	if (color.startsWith('#')) {
		if (wasmRender) {
			const rgb = wasmRender.parse_hex_color(color);
			return [rgb[0], rgb[1], rgb[2]];
		}

		const hex = color.slice(1);
		if (hex.length === 6) {
			return [
				parseInt(hex.slice(0, 2), 16) / 255,
				parseInt(hex.slice(2, 4), 16) / 255,
				parseInt(hex.slice(4, 6), 16) / 255
			];
		}
		if (hex.length === 3) {
			return [
				parseInt(hex[0] + hex[0], 16) / 255,
				parseInt(hex[1] + hex[1], 16) / 255,
				parseInt(hex[2] + hex[2], 16) / 255
			];
		}
	}

	// HSL color: hsl(h, s%, l%) → approximate RGB
	const hslMatch = color.match(/hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\)/);
	if (hslMatch) {
		const h = parseInt(hslMatch[1]) / 360;
		const s = parseInt(hslMatch[2]) / 100;
		const l = parseInt(hslMatch[3]) / 100;
		return hslToRgb(h, s, l);
	}

	return [0, 0, 0];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	if (s === 0) return [l, l, l];

	const hue2rgb = (p: number, q: number, t: number): number => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;

	return [
		hue2rgb(p, q, h + 1 / 3),
		hue2rgb(p, q, h),
		hue2rgb(p, q, h - 1 / 3)
	];
}
