/**
 * WASM Module Loader — Parallel lazy initialization with feature detection.
 *
 * Progressive enhancement tiers:
 *   Tier 0: WASM fails → pure JS + DOM rendering (zero regression)
 *   Tier 1: wasm-geom loaded → SIMD coordinate transforms
 *   Tier 2: + wasm-spatial → O(log n) hit testing
 *   Tier 3: + WebGPU → GPU-rendered elements at 60fps
 *
 * Each module initializes independently. Failures in one module don't
 * block others. The loader detects WebGPU support and reports the
 * active tier to the console.
 */

export type WasmTier = 0 | 1 | 2 | 3;

interface ModuleState {
	geom: boolean;
	spatial: boolean;
	diff: boolean;
	render: boolean;
	webgpu: boolean;
}

const state: ModuleState = {
	geom: false,
	spatial: false,
	diff: false,
	render: false,
	webgpu: false
};

let initPromise: Promise<WasmTier> | null = null;

/**
 * Initialize all WASM modules in parallel.
 *
 * Returns the highest achieved progressive enhancement tier.
 * Safe to call multiple times — subsequent calls return the cached result.
 */
export async function initWasm(): Promise<WasmTier> {
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const start = performance.now();
		console.info('[wasm] Initializing WASM modules...');

		// Check WebGPU support
		state.webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;

		// Load all modules in parallel — each handles its own errors
		const results = await Promise.allSettled([
			loadModule('geom'),
			loadModule('spatial'),
			loadModule('diff'),
			loadModule('render')
		]);

		state.geom = results[0].status === 'fulfilled';
		state.spatial = results[1].status === 'fulfilled';
		state.diff = results[2].status === 'fulfilled';
		state.render = results[3].status === 'fulfilled';

		const tier = getCurrentTier();
		const elapsed = (performance.now() - start).toFixed(1);
		console.info(`[wasm] Initialized in ${elapsed}ms — Tier ${tier}`, state);

		return tier;
	})();

	return initPromise;
}

/**
 * Load a single WASM module by name.
 *
 * Uses dynamic import so Vite can code-split and the modules
 * only load when needed.
 */
async function loadModule(name: string): Promise<void> {
	try {
		// Dynamic import from wasm-pack output directory
		// These paths are resolved by Vite at build time
		switch (name) {
			case 'geom':
				await import('wasm-geom');
				break;
			case 'spatial':
				await import('wasm-spatial');
				break;
			case 'diff':
				await import('wasm-diff');
				break;
			case 'render':
				await import('wasm-render');
				break;
		}
		console.info(`[wasm] Loaded: ${name}`);
	} catch (err) {
		console.warn(`[wasm] Failed to load ${name}:`, err);
		throw err;
	}
}

/** Get the current progressive enhancement tier. */
export function getCurrentTier(): WasmTier {
	if (state.render && state.webgpu) return 3;
	if (state.spatial) return 2;
	if (state.geom) return 1;
	return 0;
}

/** Check if a specific module is loaded. */
export function isModuleLoaded(module: keyof ModuleState): boolean {
	return state[module];
}

/** Check if WebGPU is available in this browser. */
export function isWebGpuAvailable(): boolean {
	return state.webgpu;
}

/** Get the full module state (for debugging). */
export function getModuleState(): Readonly<ModuleState> {
	return { ...state };
}
