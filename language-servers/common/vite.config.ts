import { resolve, join } from 'node:path';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

const src = resolve(__dirname, 'src');

export default defineConfig({
  plugins: [
    dts({ entryRoot: src }),
    externalizeDeps({ except: ["@readmeseemore/language-servers-interop"] })
  ],
  build: {
    lib: {
      entry: join(src, 'index.ts'),
      fileName: 'index',
      formats: ['es']
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
})