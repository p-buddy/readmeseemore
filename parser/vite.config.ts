import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';
import { name } from './package.json';

export default defineConfig({
    build: {
        lib: {
            name: name.replace('@', '').replace('/', '_'),
            fileName: 'index',
            entry: resolve(__dirname, 'src/index.ts'),
        },
    },
    test: {
        include: ["src/**/*.{test,spec}.{js,ts}"],
        reporters: ["verbose", "@readmeseemore/tests-as-documentation/Reporter"],
    },
    plugins: [dts(), externalizeDeps()],
});