import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import wasmPack from './vite-plugin-wasm-pack';

export default defineConfig({
	plugins: [tailwindcss(), wasmPack(), sveltekit()],
	assetsInclude: ['**/*.wasm']
});
