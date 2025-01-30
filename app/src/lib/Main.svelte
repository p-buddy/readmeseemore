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
  import { type FileSystemTree } from "@webcontainer/api";
  import MountedDiv from "./utils/MountedDiv.svelte";
  import { OperatingSystem } from "$lib";
  import { deferred } from "./utils";
  import SnippetRender from "./dockview-svelte/SnippetRender.svelte";
  import H from "./H.svelte";
  import { withGrid } from "./example";
  type GridProps<T extends Record<string, any>> = PanelPropsByView<T>["grid"];

  let { filesystem }: { filesystem?: FileSystemTree } = $props();

  let os = $state<OperatingSystem>();

  $effect(() => {
    if (!os) return;
    os.xterm.options.theme = isDark.current
      ? { background: "#181818" }
      : { background: "#f3f3f3", foreground: "#000", cursor: "#666" };
    os.xterm.refresh(0, os.xterm.rows - 1);
  });
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
  <View type="dock" {...params} snippets={{ preview }} svelte={{ Editor }} />
{/snippet}

<View
  type="dock"
  svelte={{ H }}
  react={{ withGrid }}
  onReady={({ api }) => {
    /*     api.addPanel({
      component: "withGrid",
      id: "withGrid",
    }); */
    api.addSveltePanel("H", {
      onReady: () => {
        console.log("H ready");
      },
    });
  }}
/>

{#snippet pane({
  params,
}: GridProps<WithViewOnReady<"pane", { Tree: typeof Tree }>>)}
  <View type="pane" svelte={{ Tree }} {...params} />
{/snippet}

{#snippet terminal(props: GridProps<Props<typeof MountedDiv>>)}
  <MountedDiv {...props.params} />
{/snippet}
<!-- 
<View
  type="grid"
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ pane, dock, terminal }}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    os = await OperatingSystem.Create(filesystem);

    if (!os) throw new Error("Operating system not initialized");

    type DockComponents = { Editor: typeof Editor; preview: typeof preview };
    type PaneComponents = { Tree: typeof Tree };

    const defferedDockAPI = deferred<ViewAPI<"dock", DockComponents>>();
    const defferedPaneAPI = deferred<ViewAPI<"pane", PaneComponents>>();

    await api.addSnippetPanel("dock", {
      onReady: ({ api }) => {
        console.log("dock ready");
        defferedDockAPI.resolve(api);
      },
    });

    console.log("start");

    await defferedDockAPI.promise;

    const [dockAPI, _dock, paneAPI, pane, terminal] = await Promise.all([
      defferedDockAPI.promise,
      api.addSnippetPanel("dock", {
        onReady: ({ api }) => {
          console.log("dock ready");
          defferedDockAPI.resolve(api);
        },
      }),
      defferedPaneAPI.promise,
      api.addSnippetPanel(
        "pane",
        {
          onReady: ({ api }) => {
            console.log("pane ready");
            defferedPaneAPI.resolve(api);
          },
        },
        {
          maximumWidth: 800,
          size: 200,
          position: {
            direction: "left",
            referencePanel: "dock",
          },
        },
      ),
      api.addSnippetPanel(
        "terminal",
        {
          onMount(root) {
            os?.xterm.open(root);
            os?.fitXterm();
          },
        },
        {
          minimumHeight: 100,
          size: 200,
          position: {
            direction: "below",
            referencePanel: "dock",
          },
        },
      ),
    ]);

    console.log("waiting!");

    terminal.api.onDidDimensionsChange(() => os?.fitXterm());
    os.container.on("server-ready", async (port, url) => {});

    os.container.fs.writeFile("index.ts", "console.log('Hello, world!');");

    let guidCount = 0;
    const guidByPath = new Map<string, number>();

    const tree = await paneAPI!.addSveltePanel(
      "Tree",
      {
        fs: os.container.fs,
        onFileClick: async (file) => {
          if (!guidByPath.has(file.path))
            guidByPath.set(file.path, guidCount++);

          const id = `${guidByPath.get(file.path)}`;

          (
            dockAPI!.getPanel(id) ??
            (await dockAPI!.addSveltePanel(
              "Editor",
              {
                fs: os!.container.fs,
                name: file.name,
                path: file.path,
              },
              { id },
            ))
          ).api.setActive();
        },
        onPathUpdate: ({ current, previous }) => {
          const guid = guidByPath.get(previous);
          if (guid) {
            guidByPath.delete(previous);
            guidByPath.set(current, guid);
            const panel = dockAPI.getPanel(`${guid}`);
            panel?.setTitle(current.split("/").pop()!);
          }
        },
      },
      {
        title: "Explorer",
        isExpanded: true,
      },
    );
    tree.headerVisible = false;
  }}
/>
 -->
