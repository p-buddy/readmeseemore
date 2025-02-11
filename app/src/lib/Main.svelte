<script lang="ts">
  import { isDark } from "./mode";
  import Tree from "./file-tree/Tree.svelte";
  import Editor from "./Editor.svelte";
  import { type Props } from "./utils/ui-framework";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
  import { type FileSystemTree } from "@webcontainer/api";
  import MountedDiv from "./utils/MountedDiv.svelte";
  import { OperatingSystem } from "$lib";
  import { deferred } from "./utils";
  import { Orientation } from "dockview-core";
  import {
    type WithViewOnReady,
    type PanelProps,
    type ViewAPI,
    DockView,
    PaneView,
    GridView,
  } from "./dockview-svelte";

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

{#snippet preview({ params: { url } }: PanelProps<"dock", { url: string }>)}
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
}: PanelProps<
  "grid",
  WithViewOnReady<"dock", { preview: typeof preview; Editor: typeof Editor }>
>)}
  <DockView
    {...params}
    snippets={{ preview }}
    components={{ Editor }}
    watermark={{ component: VsCodeWatermark }}
  />
{/snippet}

{#snippet pane({
  params,
}: PanelProps<"grid", WithViewOnReady<"pane", { Tree: typeof Tree }>>)}
  <PaneView components={{ Tree }} {...params} />
{/snippet}

{#snippet terminal(props: PanelProps<"grid", Props<typeof MountedDiv>>)}
  <MountedDiv {...props.params} />
{/snippet}

<GridView
  orientation={Orientation.HORIZONTAL}
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ pane, dock, terminal }}
  components={{}}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    os = await OperatingSystem.Create(filesystem);

    if (!os) throw new Error("Operating system not initialized");

    type DockComponents = { Editor: typeof Editor; preview: typeof preview };
    type PaneComponents = { Tree: typeof Tree };

    const defferedDockAPI = deferred<ViewAPI<"dock", DockComponents>>();
    const defferedPaneAPI = deferred<ViewAPI<"pane", PaneComponents>>();

    const [dockAPI, _dock] = await Promise.all([
      defferedDockAPI.promise,
      api.addSnippetPanel("dock", {
        onReady: ({ api }) => defferedDockAPI.resolve(api),
      }),
    ]);

    const [paneAPI, pane, terminal] = await Promise.all([
      defferedPaneAPI.promise,
      api.addSnippetPanel(
        "pane",
        { onReady: ({ api }) => defferedPaneAPI.resolve(api) },
        {
          maximumWidth: 800,
          size: 200,
          position: {
            direction: "left",
            referencePanel: _dock.reference,
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
            referencePanel: _dock.reference,
          },
        },
      ),
    ]);

    terminal.api.onDidDimensionsChange(() => os?.fitXterm());
    os.container.on("server-ready", async (port, url) => {});

    os.container.fs.writeFile("index.ts", "console.log('Hello, world!');");

    let guidCount = 0;
    const guidByPath = new Map<string, number>();

    const tree = await paneAPI!.addComponentPanel(
      "Tree",
      {
        fs: os.container.fs,
        onFileClick: async (file) => {
          if (!guidByPath.has(file.path))
            guidByPath.set(file.path, guidCount++);

          const id = `${guidByPath.get(file.path)}`;

          (
            dockAPI!.getPanel(id) ??
            (await dockAPI!.addComponentPanel(
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
