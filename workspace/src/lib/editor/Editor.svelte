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

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile" | "readdir">;
    file: Pick<TFile, "name" | "path">;
    onSave: (path: Pick<TFile, "name" | "path">) => void;
  };

  type Editor = typeof monaco.editor;
  export type CodeEditor = monaco.editor.IStandaloneCodeEditor;

  const join = (...paths: (string | undefined)[]) =>
    paths.filter(Boolean).join("/");

  const urify = (path?: string) =>
    monaco.Uri.parse(`file:///home/workspace/${path ?? ""}`);

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

  const tryRegisterLanguageByFile = (path: string) => {
    const index = path.lastIndexOf(".");
    const extension = index > 0 ? path.slice(index + 1) : undefined;
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
    fs: WithLimitFs<"readFile">,
    path: string,
    content?: string,
  ): Promise<Reference> => {
    if (referenceByPath.has(path)) return referenceByPath.get(path)!;
    const uri = urify(path);
    content ??= await fs.readFile(path, "utf-8");
    tryRegisterLanguageByFile(path);
    const file = new RegisteredMemoryFile(uri, content);
    disposableByPath.set(path, fileSystemProvider.registerFile(file));
    const reference = await monaco.editor.createModelReference(uri);
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
            : createFileReference(fs, path),
        );
      }
      if (referenceByPath.size > 0) promises.push(cleanup(directory, existing));
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

  const createAndAttachEditor = async (
    element: HTMLElement,
    { fs, file, onSave }: Props,
    content?: string,
  ) => {
    const { path } = file;
    const { object } = await createFileReference(fs, path, content);

    const editor = monaco.editor.create(element, {
      model: object.textEditorModel,
    });

    editor.onDidChangeModelContent(() => {
      fs.writeFile(path, editor!.getValue() || "", "utf-8");
      object.save();
    });

    editor.onKeyDown((e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        onSave(file);
      }
    });

    return editor;
  };
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import type { TFile } from "../file-tree/Tree.svelte";
  import { onDestroy } from "svelte";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import { initializeOnce, tryGetLanguageByFileExtension } from "./index.js";

  let { params, api }: PanelProps<"dock", Props> = $props();

  let editor: CodeEditor | undefined;
  let futureEditor: Promise<CodeEditor> | undefined;
  let element: HTMLElement;

  let version = 0;

  const setEditor = async (promise: Promise<CodeEditor>) => {
    const current = ++version;
    futureEditor = promise;
    const update = await promise;
    if (current !== version) return;
    editor = update;
    if (futureEditor === promise) futureEditor = undefined;
  };

  $effect(() => api?.setTitle(params.file.name));

  api?.onDidVisibilityChange((visible) => {
    if (!visible || !element || editor) return;
    setEditor(createAndAttachEditor(element, params));
  });

  onDestroy(() => editor?.dispose());

  $effect(() => {
    const { path } = params.file;
    if (!editor || !element) return;
    const model = editor.getModel()!;
    const previous = model.uri.path;
    if (previous === path) return;
    editor.dispose();
    editor = undefined;
    remove(previous);
    if (api?.isVisible)
      setEditor(createAndAttachEditor(element, params, model.getValue()));
    else createFileReference(params.fs, path, model.getValue());
  });
</script>

<MountedDiv
  class="h-full w-full pt-1"
  onMount={async (_element) => {
    element = _element;

    await initializeOnce(initializer);

    createAllInProgress ??= createAllReferences(params.fs);
    await createAllInProgress;
    createAllInProgress = undefined;

    editor = await createAndAttachEditor(element, params);
  }}
/>
