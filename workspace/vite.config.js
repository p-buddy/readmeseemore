/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'

export default defineConfig({
    plugins: [sveltekit(), tailwindcss()],
    server: {
        host: "0.0.0.0",
        headers: {
            'Cross-Origin-Embedder-Policy': 'require-corp',
            'Cross-Origin-Opener-Policy': 'same-origin',
        }
    },
    optimizeDeps: {
        include: [
            "vscode-textmate",
            "vscode-oniguruma",
        ],
        esbuildOptions: {
            plugins: [
                {
                    name: "import.meta.url for @codingame only",
                    setup(args) {
                        importMetaUrlPlugin.setup({
                            ...args, onLoad: (options, callback) => {
                                args.onLoad({ ...options, filter: /.*(@codingame|monaco-).*\.js$/ }, callback);
                            }
                        })
                    }
                }
            ]
        }
    },
    worker: {
        format: "es",
    }
});