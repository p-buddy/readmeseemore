/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
//import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'

export default defineConfig({
    plugins: [nodePolyfills({ include: ['path'], }), sveltekit(), tailwindcss()],
    server: {
        host: "0.0.0.0",
    },
    test: {
        workspace: [{
            extends: "./vite.config.ts",
            plugins: [svelteTesting()],

            test: {
                name: "client",
                environment: "jsdom",
                clearMocks: true,
                include: ['src/**/*.{svelte.,}{test,spec}.{js,ts}'],
                exclude: ['src/lib/server/**'],
                setupFiles: ['./vitest-setup-client.ts']
            }
        },
            // {
            //     extends: "./vite.config.ts",

            //     test: {
            //         name: "server",
            //         environment: "jsdom",
            //         include: ['src/**/*.{test,spec}.{js,ts}'],
            //         exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
            //     }
            // }
        ]
    }
});
