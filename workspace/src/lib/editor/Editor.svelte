<script lang="ts" module>
  import * as monaco from "@codingame/monaco-vscode-editor-api";
  import { initServices } from "monaco-languageclient/vscode/services";
  import {
    RegisteredFileSystemProvider,
    RegisteredMemoryFile,
    registerFileSystemOverlay,
  } from "@codingame/monaco-vscode-files-service-override";
  import { configureDefaultWorkerFactory } from "monaco-editor-wrapper/workers/workerLoaders";
  import getLanguagesServiceOverride from "@codingame/monaco-vscode-languages-service-override";
  import getThemeServiceOverride from "@codingame/monaco-vscode-theme-service-override";
  import getTextMateServiceOverride from "@codingame/monaco-vscode-textmate-service-override";
  import { type WithLimitFs } from "../utils/fs-helper.js";

  export type Editor = monaco.editor.IStandaloneCodeEditor;

  const sanitize = (path: string) => {
    while (path.startsWith("/")) path = path.slice(1);
    return path;
  };

  const urify = (path: string) => monaco.Uri.parse(`file:///${sanitize(path)}`);

  const matches = ({ uri }: monaco.editor.ITextModel, path: string) =>
    sanitize(uri.path) === sanitize(path);

  const languageByExtension = {
    ts: "typescript",
    js: "javascript",
    svelte: "svelte",
  };

  type Extension = keyof typeof languageByExtension;
  const supportedExtensions = Object.keys(languageByExtension) as Extension[];

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

  const tryRegisterExtension = (extension?: string) => {
    if (!extension || !(extension in languageByExtension)) return;
    const language = languageByExtension[extension as Extension];
    registerLanguage(language, extension);
  };

  const getExistingModels = () =>
    new Set(
      monaco.editor.getModels().map(({ uri: { path } }) => sanitize(path)),
    );

  const fileSystemProvider = new RegisteredFileSystemProvider(false);

  const refByModel = new Map<
    monaco.editor.ITextModel,
    Awaited<ReturnType<(typeof monaco.editor)["createModelReference"]>>
  >();

  const createFileModel = async (
    path: string,
    name: string,
    fs: WithLimitFs<"readFile">,
    models?: Set<string>,
  ): Promise<monaco.editor.ITextModel | null> => {
    const { editor } = monaco;
    const sanitized = sanitize(path);
    const uri = urify(sanitized);
    models ??= getExistingModels();
    if (models.has(sanitized)) return editor.getModel(uri);
    const content = await fs.readFile(path, "utf-8");
    tryRegisterExtension(name.split(".").pop());
    models.add(sanitized);
    fileSystemProvider.registerFile(new RegisteredMemoryFile(uri, content));
    const ref = await editor.createModelReference(uri, content);
    const model = ref.object.textEditorModel;
    if (model) refByModel.set(model, ref);
    return model;
  };

  /**
   * @todo determine the performance impact of scanning whole filesystem (including node_modules)
   */
  const createAllCodeModels = (
    fs: WithLimitFs<"readdir" | "readFile">,
    options?: Partial<{
      directory: string;
      models: Set<string>;
    }>,
  ) => {
    options ??= {};
    options.directory ??= "/";
    options.models ??= getExistingModels();
    const { models, directory } = options;
    return new Promise<void>(async (resolve) => {
      const entries = await fs.readdir(directory, {
        withFileTypes: true,
      });
      await Promise.all(
        entries
          .map(async (entry) => {
            const path = `${directory}/${entry.name}`;
            return entry.isDirectory()
              ? createAllCodeModels(fs, {
                  directory: sanitize(path),
                  models,
                })
              : createFileModel(path, entry.name, fs, models);
          })
          .filter(Boolean),
      );
      resolve();
    });
  };

  let createModelsInProgress:
    | ReturnType<typeof createAllCodeModels>
    | undefined;

  let initialized: Promise<void> | undefined;
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import type { TFile } from "../file-tree/Tree.svelte";
  import { onDestroy, type Snippet } from "svelte";
  import { retry } from "../utils/index.js";
  import type { MouseEventHandler } from "svelte/elements";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile" | "readdir">;
    file: Pick<TFile, "name" | "path">;
    onSave: (path: Pick<TFile, "name" | "path">) => void;
  };

  let { params, api }: PanelProps<"dock", Props> = $props();

  const { fs, onSave } = params;

  let editor = $state<Editor>();

  $effect(() => {
    const { name } = params.file;
    api?.setTitle(name);
  });

  $effect(() => {
    if (!editor) return;
    retry(async () => {
      const contents = await fs.readFile(params.file.path, "utf-8");
      editor?.setValue(contents);
    });
  });

  onDestroy(() => {
    const model = editor?.getModel();
    if (model) refByModel.get(model)?.dispose() ?? model?.dispose();
    editor?.dispose();
  });

  const uri = $derived(urify(params.file.path));

  const path = $derived.by(() => {
    const { path } = params.file;
    const model = editor?.getModel();
    if (model && !matches(model, path)) {
      model.dispose();
    }
    return path;
  });
</script>

<MountedDiv
  class="h-full w-full pt-10"
  onMount={async (element) => {
    initialized ??= initServices({
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
      configureDefaultWorkerFactory();
      registerFileSystemOverlay(1, fileSystemProvider);
    });

    await initialized;

    createModelsInProgress ??= createAllCodeModels(fs);
    await createModelsInProgress;
    createModelsInProgress = undefined;

    const model =
      monaco.editor.getModel(uri) ??
      (await createFileModel(path, params.file.name, fs));

    editor = monaco.editor.create(element, {
      model,
    });

    if (!editor) throw new Error("Editor not found");

    editor.onDidChangeModelContent(() => {
      fs.writeFile(params.file.path, editor!.getValue() || "", "utf-8");
      const model = editor!.getModel();
      if (model) refByModel.get(model)?.object.save();
    });

    editor.onKeyDown((e) => {
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
        e.preventDefault();
        onSave(params.file);
      }
    });
  }}
/>
