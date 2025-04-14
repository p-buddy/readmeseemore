<script lang="ts" module>
  import "vscode/localExtensionHost";
  import "@codingame/monaco-vscode-theme-defaults-default-extension";
  import * as monaco from "@codingame/monaco-vscode-editor-api";
  import { initServices } from "monaco-languageclient/vscode/services";
  import {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile,
    registerFileSystemOverlay,
  } from "@codingame/monaco-vscode-files-service-override";
  import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
  import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
  import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
  import EditorWorker from "@codingame/monaco-vscode-editor-api/esm/vs/editor/editor.worker.js?worker";
  import TextMateWorker from "@codingame/monaco-vscode-textmate-service-override/worker?worker";
  import { type WithLimitFs } from "../utils/fs-helper.js";

  const workers = {
    TextEditorWorker: EditorWorker,
    TextMateWorker: TextMateWorker,
  } as Record<string, new (options?: { name?: string }) => Worker>;

  type Editor = typeof monaco.editor;
  export type CodeEditor = monaco.editor.IStandaloneCodeEditor;

  const root = "/";

  const join = (...paths: (string | undefined)[]) =>
    paths.filter(Boolean).join("/");

  const urify = (path: string) => monaco.Uri.parse(`file:///${path}`);

  const languageByExtension = {
    ts: "typescript",
    js: "javascript",
    svelte: "svelte",
  } as const;

  type Extension = keyof typeof languageByExtension;

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

  const tryGetLanguageByFileExtension = (extension?: string) => {
    if (!extension || !(extension in languageByExtension)) return;
    return languageByExtension[extension as Extension];
  };

  const tryTakeActionByLanguage = (language?: string) => {
    if (!language || !(language in actionsByLanguage)) return;
    actionsByLanguage[language as keyof typeof actionsByLanguage]?.();
  };

  const tryRegisterLanguageByFile = (name: string) => {
    const extension = name.split(".").pop();
    const language = tryGetLanguageByFileExtension(extension);
    if (extension && language) registerLanguage(language, extension);
    tryTakeActionByLanguage(language);
  };

  const fileSystemProvider = new RegisteredFileSystemProvider(false);

  type Reference = Awaited<ReturnType<Editor["createModelReference"]>>;
  const referenceByPath = new Map<string, Reference>();

  type Disposable = ReturnType<RegisteredFileSystemProvider["registerFile"]>;
  const disposableByPath = new Map<string, Disposable>();

  const remove = (path: string) => {
    referenceByPath.get(path)?.dispose();
    referenceByPath.delete(path);
    disposableByPath.get(path)?.dispose();
    disposableByPath.delete(path);
  };

  const cleanup = async (location: string | undefined, valid: Set<string>) => {
    const uri = urify(location ?? "");
    for (const [name] of await fileSystemProvider.readdir(uri))
      if (!valid.has(name)) remove(join(location, name));
  };

  const createFileReference = async (
    path: string,
    name: string,
    fs: WithLimitFs<"readFile">,
  ): Promise<Reference | undefined> => {
    const uri = urify(path);
    if (referenceByPath.has(path)) return referenceByPath.get(path);
    const content = await fs.readFile(path, "utf-8");
    tryRegisterLanguageByFile(name);
    disposableByPath.set(
      path,
      fileSystemProvider.registerFile(new RegisteredMemoryFile(uri, content)),
    );
    console.log(uri, content);
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
            : createFileReference(path, entry.name, fs),
        );
      }
      promises.push(cleanup(directory, existing));
      await Promise.all(promises);
      resolve();
    });
  };

  let createModelsInProgress:
    | ReturnType<typeof createAllReferences>
    | undefined;
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import type { TFile } from "../file-tree/Tree.svelte";
  import { onDestroy } from "svelte";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import { actionsByLanguage } from "./actions.js";
  import { initialize } from "./index.js";

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
  class="h-full w-full pt-10"
  onMount={async (element) => {
    await initialize(() =>
      initServices({
        enableExtHostWorker: true,
        serviceOverrides: {
          ...getLanguagesServiceOverride(),
          ...getThemeServiceOverride(),
          ...getTextMateServiceOverride(),
        },
        userConfiguration: {
          json: JSON.stringify({
            "workbench.colorTheme": "Default Dark Modern",
            "editor.experimental.asyncTokenization": true,
          }),
        },
      }).then(() => {
        registerFileSystemOverlay(1, fileSystemProvider);
        window.MonacoEnvironment!.getWorker = (moduleId, label) => {
          console.log("getWorker", moduleId, label);
          const Worker = workers[label];
          if (Worker === undefined)
            throw new Error(`Unimplemented worker ${label} (${moduleId})`);
          return new Worker();
        };
      }),
    );

    createModelsInProgress ??= createAllReferences(fs);
    await createModelsInProgress;
    createModelsInProgress = undefined;

    reference = await createFileReference(path, params.file.name, fs);

    if (!reference)
      throw new Error(`Could not create reference for file: ${path}`);

    editor = monaco.editor.create(element, {
      model: reference.object.textEditorModel,
    });

    if (!editor) throw new Error("Editor not found");

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
