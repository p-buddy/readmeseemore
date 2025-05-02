<script lang="ts" module>
  import * as monaco from "@codingame/monaco-vscode-editor-api";
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

  type Reference = ReturnType<Editor["createModelReference"]>;

  const fileReferences = new Map<string, Reference>();

  const createFileReference = async (path: string): Promise<Reference> => {
    if (fileReferences.has(path)) return fileReferences.get(path)!;
    try {
      tryRegisterLanguageByFile(path);
      const reference = monaco.editor.createModelReference(urify(path));
      fileReferences.set(path, reference);
      return reference;
    } catch (e) {
      console.error(`Failed to create file reference for ${path}`, e);
      throw e;
    }
  };

  const createAndAttachEditor = async (
    element: HTMLElement,
    { fs, file, onSave }: Props,
  ) => {
    const { path } = file;
    const { object } = await createFileReference(path);

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
  import { initialization, tryGetLanguageByFileExtension } from "./index.js";
  import { root } from "$lib/utils/webcontainer.js";
  import { exists } from "./utils.js";

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

  onDestroy(() => editor?.dispose());

  const attachNewFile = async (path: string) => {
    while (!(await exists(params.fs, path)))
      await new Promise(requestAnimationFrame);
    if (params.file.path !== path || !element) return;
    if (api?.isVisible) awaitEditor(createAndAttachEditor(element, params));
    else createFileReference(path);
  };

  $effect(() => {
    const { path } = params.file;
    if (!editor || !element) return;
    const model = editor.getModel()!;
    const previous = model.uri.path;
    if (previous === path) return;
    const reference = fileReferences.get(previous);
    fileReferences.delete(previous);
    if (reference) reference.then((ref) => ref.dispose());
    editor.dispose();
    editor = undefined;
    attachNewFile(path);
  });
</script>

<MountedDiv
  class="h-full w-full pt-1"
  bind:element
  onMount={async (element) => {
    await initialization;
    editor = await createAndAttachEditor(element, params);
  }}
/>
