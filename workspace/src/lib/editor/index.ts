import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper";
import { registerFileSystemOverlay } from "@codingame/monaco-vscode-files-service-override";
import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
import type { FileSystemProvider } from "./file-system-provider.js";

let initializing: Promise<void> | undefined;
let initialized = false;

const onInitCallbacks = new Set<() => void>();

export const onEditorInit = (callback: () => void) => {
  if (initialized) return callback();
  onInitCallbacks.add(callback);
}

const wrapper = new MonacoEditorLanguageClientWrapper();

export const initialization = wrapper
  .init({
    $type: "extended",
    vscodeApiConfig: {
      enableExtHostWorker: true,
      userConfiguration: {
        json: JSON.stringify({
          "workbench.colorTheme": "Default Dark Modern",
          "typescript.tsserver.web.projectWideIntellisense.enabled": true,
          "typescript.tsserver.web.projectWideIntellisense.suppressSemanticErrors": false,
          "diffEditor.renderSideBySide": false,
          "editor.lightbulb.enabled": "on",
          "editor.glyphMargin": true,
          "editor.guides.bracketPairsHorizontal": true,
          "editor.experimental.asyncTokenization": true,
          "editor.automaticLayout": true,
        }),
      },
    },
    editorAppConfig: {
      monacoWorkerFactory: configureDefaultWorkerFactory,
    },
  })
  .then(() => {
    wrapper.getEditorApp()?.dispose();
    for (const callback of onInitCallbacks) callback();
    onInitCallbacks.clear();
    initialized = true;
  });

export const initializeOnce = (initializer: () => typeof initializing, provider: FileSystemProvider) => {
  if (initializing) return initializing;
  initializing = initializer();
  initializing!.then(() => {
    registerFileSystemOverlay(1, provider);
    for (const callback of onInitCallbacks) callback();
    onInitCallbacks.clear();
    initialized = true;
  });
  return initializing;
};

export const languageByExtension = {
  ts: "typescript",
  js: "javascript",
  svelte: "svelte",
  html: "html",
  css: "css",
  md: "markdown",
  json: "json",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  jsx: "react",
  tsx: "react",
} as const;

export type Extension = keyof typeof languageByExtension;
export type SupportedLanguage = typeof languageByExtension[Extension];

export const tryGetLanguageByFileExtension = (extension?: string) => {
  if (!extension || !(extension in languageByExtension)) return;
  return languageByExtension[extension as Extension];
};

export const tryGetLanguageByFile = (path?: string) => {
  if (!path) return;
  const index = path.lastIndexOf(".");
  if (index < 0) return;
  const extension = path.slice(index + 1);
  return tryGetLanguageByFileExtension(extension);
};