import { resolve, join } from 'path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

const src = resolve(__dirname, 'src');

const files = {
    index: join(src, 'index.ts'),
    Reporter: join(src, 'Reporter.ts'),
}

const testPattern = "src/**/*.{test,spec}.{js,ts}";

export default defineConfig({
    build: {
        lib: {
            entry: files,
            name: 'TestsAsDocumentation',
            fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
        }
    },
    plugins: [
        dts({ exclude: [testPattern] }),
        externalizeDeps({ nodeBuiltins: true })
    ],
    test: {
        include: [testPattern],
        reporters: ["verbose", files.Reporter],
    }
});