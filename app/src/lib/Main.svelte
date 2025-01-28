<script lang="ts">
  import {
    View,
    type PanelPropsByView,
    type ViewAPI,
    type WithViewOnReady,
  } from "./dockview-svelte";
  import { isDark } from "./mode";
  import Tree from "./file-tree/Tree.svelte";
  import Editor from "./Editor.svelte";
  import { typedReactify, type Props } from "./utils/ui-framework";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
  import { WebContainer, type FileSystemTree } from "@webcontainer/api";
  import { file } from "./utils/fs-helper";
  import { Terminal as XTerm } from "xterm";
  import { FitAddon } from "xterm-addon-fit";
  import MountedDiv from "./utils/MountedDiv.svelte";

  let { filesystem }: { filesystem?: FileSystemTree } = $props();

  const terminalTheme = $derived(
    isDark.current
      ? { background: "#181818" }
      : { background: "#f3f3f3", foreground: "#000", cursor: "#666" },
  );

  const startOS = async (filesystem?: FileSystemTree) => {
    const container = await WebContainer.boot();

    container.mount({
      ...file(".jshrc", [
        'export PNPM_HOME="/home/.pnpm"',
        'export PATH="/bin:/usr/bin:/usr/local/bin:/home/.pnpm"',
        'alias ni="npx -y --package=@antfu/ni -- ni"',
      ]),
      ...(filesystem ?? {}),
    });

    await container.spawn("mv", [".jshrc", "/home/.jshrc"]);

    const xterm = new XTerm({ convertEol: true, theme: terminalTheme });
    const addon = new FitAddon();
    const { cols, rows } = xterm;
    xterm.loadAddon(addon);
    $effect(() => {
      xterm.options.theme = terminalTheme;
      xterm.refresh(0, xterm.rows - 1);
    });

    const jsh = await container.spawn("jsh", {
      env: {},
      terminal: { cols, rows },
    });

    const reader = jsh.output.getReader();
    const input = jsh.input.getWriter();
    await reader.read();
    reader.releaseLock();

    xterm.onData((data) => {
      input.write(data);
    });
    jsh.output.pipeTo(
      new WritableStream({
        write(data) {
          xterm.write(data);
        },
      }),
    );
    xterm.clear();
    const fit = () => addon.fit();
    return { container, xterm, jsh, fit };
  };

  type GridProps<T extends Record<string, any>> = PanelPropsByView<T>["grid"];
</script>

{#snippet preview({
  params: { url },
}: PanelPropsByView<{ url: string }>["dock"])}
  {/* @ts-ignore */ null}
  <iframe
    src={url}
    allow="cross-origin-isolated"
    credentialless
    title="preview"
  >
  </iframe>
{/snippet}

{#snippet dock({
  params,
}: GridProps<
  WithViewOnReady<"dock", { Editor: typeof Editor; preview: typeof preview }>
>)}
  <View
    type="dock"
    svelte={{ Editor }}
    snippets={{ preview }}
    watermarkComponent={typedReactify(VsCodeWatermark)}
    {...params}
  />
{/snippet}

{#snippet pane({
  params,
}: GridProps<WithViewOnReady<"pane", { Tree: typeof Tree }>>)}
  <View type="pane" svelte={{ Tree }} {...params} />
{/snippet}

{#snippet terminal(props: GridProps<Props<typeof MountedDiv>>)}
  <MountedDiv {...props.params} />
{/snippet}

<View
  type="grid"
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ pane, dock, terminal }}
  svelte={{}}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    const { container, xterm, jsh, fit } = await startOS(filesystem);

    type DockComponents = { Editor: typeof Editor; preview: typeof preview };
    type PaneComponents = { Tree: typeof Tree };

    let dockAPI: ViewAPI<"dock", DockComponents>;
    let paneAPI: ViewAPI<"pane", PaneComponents>;

    const [dock, pane, terminal] = await Promise.all([
      api.addSnippetPanel("dock", {
        onReady: ({ api }) => (dockAPI = api),
      }),
      api.addSnippetPanel("pane", {
        onReady: ({ api }) => (paneAPI = api),
      }),
      api.addSnippetPanel("terminal", {
        onMount(root) {
          xterm.open(root);
          fit();
        },
      }),
    ]);

    terminal.api.onDidDimensionsChange(fit);
    container.on("server-ready", async (port, url) => {});
  }}
/>
