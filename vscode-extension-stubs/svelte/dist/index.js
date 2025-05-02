/** THIS FILE IS GENERATED. MANUAL EDITS WILL NOT BE PRESERVED. */
import { registerExtension } from '@codingame/monaco-vscode-api/extensions';

const manifest = {
  "name": "svelte-vscode",
  "version": "109.5.4",
  "displayName": "Svelte for VS Code",
  "publisher": "svelte",
  "engines": {
    "vscode": "^1.82.0"
  },
  "contributes": {
    "languages": [
      {
        "id": "svelte",
        "aliases": [
          "Svelte",
          "svelte"
        ],
        "extensions": [
          ".svelte"
        ],
        "configuration": "./language-configuration.json"
      },
      {
        "id": "json",
        "filenames": [
          ".prettierrc"
        ]
      }
    ],
    "grammars": [
      {
        "language": "svelte",
        "scopeName": "source.svelte",
        "path": "./syntaxes/svelte.tmLanguage.json",
        "embeddedLanguages": {
          "text.html.basic": "html",
          "text.html.markdown": "markdown",
          "text.pug": "jade",
          "source.css": "css",
          "source.css.less": "less",
          "source.css.scss": "scss",
          "source.css.postcss": "postcss",
          "source.sass": "sass",
          "source.stylus": "stylus",
          "source.js": "javascript",
          "source.ts": "typescript",
          "source.coffee": "coffeescript"
        },
        "unbalancedBracketScopes": [
          "keyword.operator.relational",
          "storage.type.function.arrow",
          "keyword.operator.bitwise.shift",
          "meta.brace.angle",
          "punctuation.definition.tag"
        ]
      },
      {
        "scopeName": "svelte.pug",
        "path": "./syntaxes/pug-svelte.json",
        "injectTo": [
          "source.svelte"
        ],
        "embeddedLanguages": {
          "source.ts": "typescript",
          "text.pug": "jade"
        }
      },
      {
        "scopeName": "svelte.pug.tags",
        "path": "./syntaxes/pug-svelte-tags.json",
        "injectTo": [
          "source.svelte"
        ],
        "embeddedLanguages": {
          "source.ts": "typescript",
          "text.pug": "jade"
        }
      },
      {
        "scopeName": "svelte.pug.dotblock",
        "path": "./syntaxes/pug-svelte-dotblock.json",
        "injectTo": [
          "source.svelte"
        ],
        "embeddedLanguages": {
          "source.ts": "typescript"
        }
      },
      {
        "scopeName": "markdown.svelte.codeblock",
        "path": "./syntaxes/markdown-svelte.json",
        "injectTo": [
          "text.html.markdown",
          "source.mdx"
        ],
        "embeddedLanguages": {
          "meta.embedded.block.svelte": "svelte"
        }
      },
      {
        "scopeName": "markdown.svelte.codeblock.script",
        "path": "./syntaxes/markdown-svelte-js.json",
        "injectTo": [
          "text.html.markdown",
          "source.mdx"
        ]
      },
      {
        "scopeName": "markdown.svelte.codeblock.style",
        "path": "./syntaxes/markdown-svelte-css.json",
        "injectTo": [
          "text.html.markdown",
          "source.mdx"
        ]
      },
      {
        "scopeName": "source.css.postcss",
        "path": "./syntaxes/postcss.json",
        "injectTo": [
          "source.svelte"
        ]
      }
    ],
    "snippets": [
      {
        "language": "svelte",
        "path": "./snippets/svelte.json"
      },
      {
        "language": "javascript",
        "path": "./snippets/javascript.json"
      },
      {
        "language": "typescript",
        "path": "./snippets/typescript.json"
      }
    ]
  }
};

const registration = registerExtension(manifest, undefined, {"system":true});

// @ts-ignore - TODO: determine why `registerFileUrl` does not exist on the return of `registerExtension`
const { whenReady, registerFileUrl } = registration;

registerFileUrl('./language-configuration.json', new URL('./resources/language-configuration.json', import.meta.url).toString(), {"size":1269,"mimeType":"application/json"});
registerFileUrl('./syntaxes/svelte.tmLanguage.json', new URL('./resources/svelte.tmLanguage.json', import.meta.url).toString(), {"size":29881,"mimeType":"application/json"});
registerFileUrl('./syntaxes/pug-svelte.json', new URL('./resources/pug-svelte.json', import.meta.url).toString(), {"size":11408,"mimeType":"application/json"});
registerFileUrl('./syntaxes/pug-svelte-tags.json', new URL('./resources/pug-svelte-tags.json', import.meta.url).toString(), {"size":6021,"mimeType":"application/json"});
registerFileUrl('./syntaxes/pug-svelte-dotblock.json', new URL('./resources/pug-svelte-dotblock.json', import.meta.url).toString(), {"size":1521,"mimeType":"application/json"});
registerFileUrl('./syntaxes/markdown-svelte.json', new URL('./resources/markdown-svelte.json', import.meta.url).toString(), {"size":1410,"mimeType":"application/json"});
registerFileUrl('./syntaxes/markdown-svelte-js.json', new URL('./resources/markdown-svelte-js.json', import.meta.url).toString(), {"size":571,"mimeType":"application/json"});
registerFileUrl('./syntaxes/markdown-svelte-css.json', new URL('./resources/markdown-svelte-css.json', import.meta.url).toString(), {"size":571,"mimeType":"application/json"});
registerFileUrl('./syntaxes/postcss.json', new URL('./resources/postcss.json', import.meta.url).toString(), {"size":9205,"mimeType":"application/json"});
registerFileUrl('./snippets/svelte.json', new URL('./resources/svelte.json', import.meta.url).toString(), {"size":891,"mimeType":"application/json"});
registerFileUrl('./snippets/javascript.json', new URL('./resources/javascript.json', import.meta.url).toString(), {"size":1265,"mimeType":"application/json"});
registerFileUrl('./snippets/typescript.json', new URL('./resources/typescript.json', import.meta.url).toString(), {"size":1114,"mimeType":"application/json"});
registerFileUrl('package.json', new URL('./resources/package.json', import.meta.url).toString(), {"size":27334,"mimeType":"application/json"});

export { whenReady };