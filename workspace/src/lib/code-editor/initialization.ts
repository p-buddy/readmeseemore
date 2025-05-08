import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper";

const onInitCallbacks = new Set<() => void>();
let initialized = false;

export const onInitialization = (callback: () => void) => {
  if (initialized) return callback();
  onInitCallbacks.add(callback);
};

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




