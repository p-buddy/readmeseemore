import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

const testPattern = "src/**/*.{test,spec}.{js,ts}";
export default defineConfig({
    build: {
        lib: {
            name: 'read-me-see-more-parser',
            fileName: 'index',
            entry: './src/index.ts',
        },
    },
    test: {
        include: [testPattern],
    },
    plugins: [dts({ exclude: testPattern })],
});