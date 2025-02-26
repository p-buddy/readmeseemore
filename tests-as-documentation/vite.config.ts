import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';
import { testPattern, externalizePackageDependencies, generateSrcTypeDeclarationsPlugin } from '../globals';

const files = {
    index: resolve(__dirname, 'src/index.ts'),
    Reporter: resolve(__dirname, 'src/Reporter.ts'),
}

export default defineConfig({
    build: {
        lib: {
            entry: files,
            name: 'TestsAsDocumentation',
            fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: [...externalizePackageDependencies(pkg), "fs", "path"]
        }
    },
    plugins: [generateSrcTypeDeclarationsPlugin()],
    test: {
        include: [testPattern],
        reporters: ["verbose", files.Reporter],
    }
});