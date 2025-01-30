<script lang="ts" module>
  import type * as monaco from "monaco-editor";

  export type Editor = monaco.editor.IStandaloneCodeEditor;
  export type Monaco = typeof monaco;
</script>

<script lang="ts">
  import type { PanelPropsByView } from "./dockview-svelte";
  import Monaco from "@monaco-editor/react";
  import {
    AutoTypings,
    LocalStorageCache,
  } from "monaco-editor-auto-typings/custom-editor";
  import type { CollabInstance } from "./collaboration";
  import { sveltify } from "@p-buddy/svelte-preprocess-react";
  import { isDark } from "./mode";
  import type { WithLimitFs } from "./utils/fs-helper";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile">;
    name: string;
    path: string;
    sync?: CollabInstance;
  };

  let { params, api }: PanelPropsByView<Props>["dock"] = $props();

  const { fs, sync } = params;

  const react = sveltify({ Monaco });
  const sourceCache = new LocalStorageCache();

  let editor: Editor;
  let monaco: Monaco;

  const init = async () => {
    if (!editor || !monaco) throw new Error("Editor not mounted");
    AutoTypings.create(editor, { monaco, sourceCache, fileRootPath: "./" });
    let contents = "";
    try {
      contents = await fs.readFile(params.path, "utf-8");
    } catch (e) {}
    editor.setValue(contents);
    if (sync) {
      editor.updateOptions({ readOnly: false });
      sync.syncEditor(editor);
    }
  };

  $effect(() => api?.setTitle(params.name));
</script>

<react.Monaco
  path={params.path}
  theme={isDark.current ? "vs-dark" : "vs-light"}
  options={{ readOnly: true, padding: { top: 10 } }}
  onChange={(value) => fs.writeFile(params.path, value || "", "utf-8")}
  onMount={(_editor, _monaco) => {
    editor = _editor;
    monaco = _monaco;
    init();
  }}
/>
