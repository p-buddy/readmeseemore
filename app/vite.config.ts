import { defineConfig } from "vitest/config";
import { sveltekit } from '@sveltejs/kit/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';


export default defineConfig({
    plugins: [nodePolyfills(), sveltekit()],

    test: {
        include: ['src/**/*.{test,spec}.{js,ts}']
    },
});
