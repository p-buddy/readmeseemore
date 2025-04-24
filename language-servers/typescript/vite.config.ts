import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { externalizeDeps } from 'vite-plugin-externalize-deps'

export default defineConfig({
  plugins: [externalizeDeps()],
  build: {
    lib: {
      fileName: 'cli',
      entry: resolve(__dirname, 'src/cli.ts'),
      formats: ['es']
    },
    emptyOutDir: false,
  }
});
