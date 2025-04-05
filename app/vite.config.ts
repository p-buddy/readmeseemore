import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	server: {
		host: "0.0.0.0"
	},
	plugins: [nodePolyfills(), tailwindcss(), sveltekit()]
});
