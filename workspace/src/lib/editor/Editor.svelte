<script lang="ts" module>
  import * as monaco from "@codingame/monaco-vscode-editor-api";
  import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper";
  import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
  import {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile,
    registerFileSystemOverlay,
  } from "@codingame/monaco-vscode-files-service-override";
  import { type WithLimitFs } from "../utils/fs-helper.js";

  type Editor = typeof monaco.editor;
  export type CodeEditor = monaco.editor.IStandaloneCodeEditor;

  const join = (...paths: (string | undefined)[]) =>
    paths.filter(Boolean).join("/");

  const urify = (path?: string) => monaco.Uri.parse(`file:///${path ?? ""}`);

  const registeredLanguages = new Set<string>();

  export const registerLanguage = (id: string, ...extensions: string[]) => {
    if (registeredLanguages.has(id)) return;
    if (extensions.length === 0) extensions.push(`.${id}`);
    extensions = extensions.map((ext) =>
      ext.startsWith(".") ? ext : `.${ext}`,
    );
    monaco.languages.register({
      id,
      aliases: [id],
      extensions,
    });
    registeredLanguages.add(id);
  };

  const tryRegisterLanguageByFile = (name: string) => {
    const extension = name.split(".").pop();
    const language = tryGetLanguageByFileExtension(extension);
    if (extension && language) registerLanguage(language, extension);
  };

  const fileSystemProvider = new RegisteredFileSystemProvider(false);

  type Reference = Awaited<ReturnType<Editor["createModelReference"]>>;
  const referenceByPath = new Map<string, Reference>();

  type Disposable = ReturnType<RegisteredFileSystemProvider["registerFile"]>;
  const disposableByPath = new Map<string, Disposable>();

  const dispose = (map: Map<string, Disposable>, key: string) => {
    map.get(key)?.dispose();
    map.delete(key);
  };

  const remove = (path: string) => {
    dispose(referenceByPath, path);
    dispose(disposableByPath, path);
  };

  const cleanup = async (directory: string | undefined, valid: Set<string>) => {
    for (const [name] of await fileSystemProvider.readdir(urify(directory)))
      if (!valid.has(name)) remove(join(directory, name));
  };

  const createFileReference = async (
    path: string,
    name: string,
    fs: WithLimitFs<"readFile">,
  ): Promise<Reference | undefined> => {
    if (referenceByPath.has(path)) return referenceByPath.get(path);
    const uri = urify(path);
    const content = await fs.readFile(path, "utf-8");
    tryRegisterLanguageByFile(name);
    const file = new RegisteredMemoryFile(uri, content);
    disposableByPath.set(path, fileSystemProvider.registerFile(file));
    const reference = await monaco.editor.createModelReference(uri);
    reference.object.setLanguageId("typescript");
    referenceByPath.set(path, reference);
    return reference;
  };

  /**
   * @todo determine the performance impact of scanning whole filesystem (including node_modules)
   */
  const createAllReferences = (
    fs: WithLimitFs<"readdir" | "readFile">,
    directory?: string,
  ) => {
    return new Promise<void>(async (resolve) => {
      const entries = await fs.readdir(directory ?? "/", {
        withFileTypes: true,
      });
      const existing = new Set<string>(entries.map((entry) => entry.name));
      const promises = new Array<Promise<any>>();
      for (const entry of entries) {
        const path = join(directory, entry.name);
        promises.push(
          entry.isDirectory()
            ? createAllReferences(fs, path)
            : createFileReference(path, entry.name, fs),
        );
      }
      promises.push(cleanup(directory, existing));
      await Promise.all(promises);
      resolve();
    });
  };

  let createAllInProgress: ReturnType<typeof createAllReferences> | undefined;

  const wrapper = new MonacoEditorLanguageClientWrapper();

  const initializer = () =>
    wrapper
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
            }),
          },
        },
        editorAppConfig: {
          monacoWorkerFactory: configureDefaultWorkerFactory,
        },
      })
      .then(() => {
        registerFileSystemOverlay(1, fileSystemProvider);
        wrapper.getEditorApp()?.dispose();
      });
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import type { TFile } from "../file-tree/Tree.svelte";
  import { onDestroy } from "svelte";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import { initializeOnce, tryGetLanguageByFileExtension } from "./index.js";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile" | "readdir">;
    file: Pick<TFile, "name" | "path">;
    onSave: (path: Pick<TFile, "name" | "path">) => void;
  };

  let { params, api }: PanelProps<"dock", Props> = $props();

  const { fs, onSave } = params;

  let editor = $state<CodeEditor>();
  let reference = $state<ReturnType<typeof referenceByPath.get>>();

  $effect(() => {
    const { name } = params.file;
    api?.setTitle(name);
  });

  onDestroy(() => {
    editor?.dispose();
  });

  const path = $derived.by(() => {
    const { path } = params.file;
    if (!editor) return path;
    const model = editor.getModel()!;
    const previous = model.uri.path.split("/").pop()!;
    if (previous === path) return path;
    editor!.updateOptions({ readOnly: true });
    createFileReference(path, params.file.name, fs).then((updated) => {
      editor!.setModel(updated?.object.textEditorModel ?? null);
      editor!.updateOptions({ readOnly: false });
      remove(previous);
    });
    return path;
  });
</script>

<MountedDiv
  class="h-full w-full pt-1"
  onMount={async (element) => {
    await initializeOnce(initializer);

    createAllInProgress ??= createAllReferences(fs);
    await createAllInProgress;
    createAllInProgress = undefined;

    reference = await createFileReference(path, params.file.name, fs);

    if (!reference)
      throw new Error(`Could not create reference for file: ${path}`);

    editor = monaco.editor.create(element, {
      model: reference.object.textEditorModel,
    });

    editor.onDidChangeModelContent(() => {
      fs.writeFile(path, editor!.getValue() || "", "utf-8");
      referenceByPath.get(path)?.object.save();
    });

    editor.onKeyDown((e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        onSave(params.file);
      }
    });
  }}
/>
