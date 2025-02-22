<script lang="ts" module>
  import type * as monaco from "monaco-editor";

  export type Editor = monaco.editor.IStandaloneCodeEditor;
  export type Monaco = typeof monaco;
</script>

<script lang="ts">
  import type { PanelProps } from "./dockview-svelte";
  import Monaco from "@monaco-editor/react";
  import {
    AutoTypings,
    LocalStorageCache,
  } from "monaco-editor-auto-typings/custom-editor";
  import type { CollabInstance } from "./collaboration";
  import { sveltify } from "@p-buddy/svelte-preprocess-react";
  import { isDark } from "./mode";
  import { type WithLimitFs } from "./utils/fs-helper";
  import type { TFile } from "./file-tree/Tree.svelte";
  import { onDestroy } from "svelte";
  import { retry } from "./utils";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile">;
    sync?: CollabInstance;
  } & { file: Pick<TFile, "name" | "path"> };

  let { params, api }: PanelProps<"dock", Props> = $props();

  const { fs, sync } = params;

  const react = sveltify({ Monaco });

  const sourceCache = new LocalStorageCache();

  let editor = $state<Editor>();
  let typings: AutoTypings;

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
    editor?.dispose();
    typings?.dispose();
  });

  const path = $derived.by(() => {
    const { path } = params.file;
    const model = editor?.getModel();
    if (model?.uri && model.uri.path !== path) model.dispose();
    return path;
  });
</script>

<react.Monaco
  {path}
  theme={isDark.current ? "vs-dark" : "vs-light"}
  keepCurrentModel={false}
  options={{ padding: { top: 10 } }}
  onChange={(value) => fs.writeFile(params.file.path, value || "", "utf-8")}
  onMount={(_editor, monaco) => {
    editor = _editor;
    AutoTypings.create(editor, {
      monaco,
      sourceCache,
    }).then((t) => (typings = t));
    sync?.syncEditor(editor);
  }}
/>
