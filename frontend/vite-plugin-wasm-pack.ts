/**
 * Vite Plugin: wasm-pack integration.
 *
 * Runs `wasm-pack build` for each Rust crate before Vite serves or builds.
 * Registers the output `pkg/` directories as Vite aliases so that
 * `import('wasm-geom')` resolves to the compiled WASM package.
 *
 * ## How it works
 *
 * 1. On `configResolved`: runs wasm-pack build for all crates in parallel
 * 2. Configures Vite aliases: `wasm-geom` → `../wasm/crates/geom/pkg`
 * 3. Adds `optimizeDeps.exclude` so Vite doesn't try to pre-bundle WASM
 * 4. Allows `server.fs` access to the wasm/ directory
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

interface WasmPackCrate {
	/** Crate name (used as the import name) */
	name: string;
	/** Path to the crate directory (relative to project root) */
	path: string;
}

const CRATES: WasmPackCrate[] = [
	{ name: 'wasm-geom', path: '../wasm/crates/geom' },
	{ name: 'wasm-spatial', path: '../wasm/crates/spatial' },
	{ name: 'wasm-diff', path: '../wasm/crates/diff' },
	{ name: 'wasm-render', path: '../wasm/crates/render' }
];

export default function wasmPackPlugin(): Plugin {
	let config: ResolvedConfig;

	return {
		name: 'vite-plugin-wasm-pack',

		config() {
			// Set up aliases and exclusions
			const aliases: Record<string, string> = {};
			const exclude: string[] = [];

			for (const crate of CRATES) {
				const pkgDir = path.resolve(__dirname, crate.path, 'pkg');
				aliases[crate.name] = pkgDir;
				exclude.push(crate.name);
			}

			return {
				resolve: {
					alias: aliases
				},
				optimizeDeps: {
					exclude
				},
				server: {
					fs: {
						allow: [path.resolve(__dirname, '..')]
					}
				}
			};
		},

		configResolved(resolvedConfig) {
			config = resolvedConfig;
		},

		buildStart() {
			// Build all WASM crates
			for (const crate of CRATES) {
				const cratePath = path.resolve(__dirname, crate.path);
				const pkgPath = path.join(cratePath, 'pkg');

				// Skip if already built (for faster dev restarts)
				if (existsSync(path.join(pkgPath, `${crate.name.replace(/-/g, '_')}_bg.wasm`))) {
					config.logger.info(`[wasm-pack] ${crate.name}: using cached build`);
					continue;
				}

				config.logger.info(`[wasm-pack] Building ${crate.name}...`);
				try {
					execSync(
						`wasm-pack build --target web --out-dir pkg --out-name ${crate.name.replace(/-/g, '_')}`,
						{
							cwd: cratePath,
							stdio: 'pipe',
							env: { ...process.env, CARGO_TERM_COLOR: 'always' }
						}
					);
					config.logger.info(`[wasm-pack] ${crate.name}: built successfully`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					config.logger.warn(`[wasm-pack] ${crate.name}: build failed — WASM features will be unavailable`);
					config.logger.warn(`[wasm-pack] ${msg}`);
				}
			}
		}
	};
}
