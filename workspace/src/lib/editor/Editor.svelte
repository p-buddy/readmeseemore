<script lang="ts" module>
  import {
    IFileService,
    StandaloneServices,
  } from "@codingame/monaco-vscode-api";
  import * as monaco from "@codingame/monaco-vscode-editor-api";
  import { MonacoEditorLanguageClientWrapper } from "monaco-editor-wrapper";
  import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
  import {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile,
    registerFileSystemOverlay,
  } from "@codingame/monaco-vscode-files-service-override";
  import { AutoTypings } from "monaco-editor-auto-typings";
  import { type WithLimitFs } from "../utils/fs-helper.js";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile" | "readdir">;
    file: Pick<TFile, "name" | "path">;
    onSave: (path: Pick<TFile, "name" | "path">) => void;
  };

  type Editor = typeof monaco.editor;
  export type CodeEditor = monaco.editor.IStandaloneCodeEditor;

  const urify = (path?: string) =>
    monaco.Uri.parse("file://" + root + (path ?? ""));

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

  type VirtualFile = {
    reference: Awaited<ReturnType<Editor["createModelReference"]>>;
    handle: ReturnType<RegisteredFileSystemProvider["registerFile"]>;
    count?: number;
  };

  const fileByPath = new Map<string, VirtualFile>();
  const pendingByPath = new Map<string, Promise<VirtualFile>>();

  const store = (path: string, file: VirtualFile) => {
    file.count ??= 1;
    fileByPath.set(path, file);
  };

  const access = (path: string) => {
    const file = fileByPath.get(path);
    if (!file) return;
    file.count ??= 0;
    file.count++;
    return file;
  };

  const release = (path: string) => {
    const file = fileByPath.get(path);
    if (!file) return;
    file.count ??= 0;
    file.count--;
    if (file.count > 0) return;
    file.reference.dispose();
    file.handle.dispose();
    fileByPath.delete(path);
  };

  const createFileReference = async (
    fs: WithLimitFs<"readFile">,
    path: string,
    content?: string,
  ): Promise<VirtualFile["reference"]> => {
    const stored = access(path);
    if (stored) return stored.reference;
    const pending = pendingByPath.get(path);
    if (pending) return (await pending).reference;
    const promise = new Promise<VirtualFile>(async (resolve) => {
      const uri = urify(path);
      content ??= await fs.readFile(path, "utf-8");
      tryRegisterLanguageByFile(path);
      const file = new RegisteredMemoryFile(uri, content);
      const handle = fileSystemProvider.registerFile(file);
      const reference = await monaco.editor.createModelReference(uri);
      resolve({ reference, handle });
    });
    pendingByPath.set(path, promise);
    const file = await promise;
    store(path, file);
    pendingByPath.delete(path);
    return file.reference;
  };

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

        const service = StandaloneServices.get(IFileService);
        const { readFile, exists, getProvider } = service;
        service.readFile = (uri) => {
          console.log("readFile!!!", { uri });
          return readFile.call(service, uri);
        };
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

    /*     AutoTypings.create(editor, {
      sourceCache: {
        storeFile: async (uri: string, content: string) => {
          console.log("storeFile", { uri, content });
        },
        getFile: async (uri: string) => {
          console.log("getFile", { uri });
          return undefined;
        },
        clear: async () => {
          console.log("clear");
        },
      },
      monaco: new Proxy(monaco, {
        get(target, prop, receiver) {
          console.log("monaco", { prop });
          return Reflect.get(target, prop, receiver);
        },
      }),
    }).then((typings) => editor.onDidDispose(() => typings.dispose())); */

    return editor;
  };
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import type { TFile } from "../file-tree/Tree.svelte";
  import { onDestroy } from "svelte";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import {
    getImportedPaths,
    initializeOnce,
    tryGetLanguageByFileExtension,
  } from "./index.js";
  import { root } from "$lib/utils/webcontainer.js";

  let { params, api }: PanelProps<"dock", Props> = $props();

  let editor: CodeEditor | undefined;
  let futureEditor: Promise<CodeEditor> | undefined;
  let element = $state<HTMLDivElement>();

  let version = Number.MIN_SAFE_INTEGER;

  const awaitEditor = async (promise: Promise<CodeEditor>) => {
    const current = ++version;
    futureEditor = promise;
    const instance = await promise;
    if (current !== version) return instance.dispose();
    editor = instance;
    if (futureEditor === promise) futureEditor = undefined;
  };

  $effect(() => api?.setTitle(params.file.name));

  api?.onDidVisibilityChange((visible) => {
    if (!visible || !element || editor) return;
    awaitEditor(createAndAttachEditor(element, params));
  });

  onDestroy(() => {
    editor?.dispose();
    const value = editor?.getModel()?.getValue();
    if (!value) return;
    const imports = getImportedPaths(params.fs, params.file.path, value);
    if (imports) for (const path of imports) release(path);
  });

  $effect(() => {
    const { path } = params.file;
    if (!editor || !element) return;
    const model = editor.getModel()!;
    const previous = model.uri.path;
    if (previous === path) return;
    editor.dispose();
    editor = undefined;
    release(previous);
    const value = model.getValue();
    if (api?.isVisible)
      awaitEditor(createAndAttachEditor(element, params, value));
    else createFileReference(params.fs, path, value);
  });
</script>

<MountedDiv
  class="h-full w-full pt-1"
  bind:element
  onMount={async (element) => {
    await initializeOnce(initializer);

    const { file, fs } = params;

    const content = await fs.readFile(file.path, "utf-8");
    const imports = getImportedPaths(fs, file.path, content);
    if (imports) for (const _path of imports) createFileReference(fs, _path);

    editor = await createAndAttachEditor(element, params, content);
  }}
/>
