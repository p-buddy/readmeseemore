<script lang="ts">
  import { isDark } from "./mode.js";
  import Tree from "./file-tree/Tree.svelte";
  import Editor from "./Editor.svelte";
  import { type Props as PropsOf } from "./utils/ui-framework.js";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
  import { type FileSystemTree } from "@webcontainer/api";
  import MountedDiv from "./utils/MountedDiv.svelte";
  import OperatingSystem from "$lib/OperatingSystem.js";
  import { defer } from "./utils/index.js";
  import {
    type WithViewOnReady,
    type PanelProps,
    type ViewAPI,
    DockView,
    PaneView,
    GridView,
    Orientation,
  } from "@p-buddy/dockview-svelte";
  import FilePanelTracker from "./utils/FilePanelTracker.js";

  type Props = {
    filesystem?: FileSystemTree;
    status?: (msg: string) => void;
  };

  let { filesystem, status }: Props = $props();

  let os = $state<OperatingSystem>();

  $effect(() => {
    if (!os) return;
    const { xterm } = os;
    xterm.options.theme = isDark.current
      ? { background: "#181818" }
      : { background: "#f3f3f3", foreground: "#000", cursor: "#666" };
    xterm.refresh(0, xterm.rows - 1);
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

{#snippet terminal(props: PanelProps<"grid", PropsOf<typeof MountedDiv>>)}
  <MountedDiv {...props.params} />
{/snippet}

<GridView
  orientation={Orientation.HORIZONTAL}
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ pane, dock, terminal }}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    os = await OperatingSystem.Create({ filesystem, status });

    const { container, xterm } = os;
    const { fs } = container;

    if (!os) throw new Error("Operating system not initialized");

    type DockComponents = { Editor: typeof Editor; preview: typeof preview };
    type PaneComponents = { Tree: typeof Tree };

    const deferredAPI = {
      dock: defer<ViewAPI<"dock", DockComponents>>(),
      pane: defer<ViewAPI<"pane", PaneComponents>>(),
    };

    status?.("Adding dock");
    const [dockAPI, _dock] = await Promise.all([
      deferredAPI.dock.promise,
      api.addSnippetPanel("dock", {
        onReady: ({ api }) => deferredAPI.dock.resolve(api),
      }),
    ]);

    status?.("Adding pane");
    const [paneAPI, pane, terminal] = await Promise.all([
      deferredAPI.pane.promise,
      api.addSnippetPanel(
        "pane",
        { onReady: ({ api }) => deferredAPI.pane.resolve(api) },
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
            xterm.open(root);
            os?.fitXterm();
          },
          style: "height: 100%;",
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

    terminal.panel.api.onDidDimensionsChange(() => os?.fitXterm());
    container.on("server-ready", async (port, url) => {});

    const filePanelTracker = new FilePanelTracker();

    const pending = {
      rm: new Set<string>(),
    };

    const isEmpty = async (path: string) =>
      (await fs.readdir(path)).length === 0;

    const rm = async (path: string) => {
      fs.rm(path, { recursive: true });
      pending.rm.delete(path);
    };

    const tree = await paneAPI!.addComponentPanel(
      "Tree",
      {
        fs,
        onFileClick: async (file) => {
          const id = `${filePanelTracker.add(file.path)}`;
          (
            dockAPI!.getPanel(id) ??
            (
              await dockAPI!.addComponentPanel(
                "Editor",
                { fs, file },
                { id, title: file.name },
              )
            ).panel
          ).api.setActive();
        },
        onRemove: async ({ path }) => rm(path),
        onPathUpdate: async ({ current, previous, type }) => {
          switch (type) {
            case "folder":
              fs.mkdir(current);
              if (await isEmpty(previous)) rm(previous);
              else pending.rm.add(previous);
              break;
            case "file":
              fs.writeFile(current, await fs.readFile(previous));
              await fs.rm(previous);

              const parent = previous.split("/").slice(0, -1).join("/");
              if (pending.rm.has(parent) && (await isEmpty(parent))) rm(parent);

              if (!filePanelTracker.has("path", previous)) return;
              filePanelTracker.set(current, filePanelTracker.id(previous)!);
              filePanelTracker.drop("path", previous);
              break;
          }
        },
      },
      {
        title: "Explorer",
        isExpanded: true,
      },
    );

    status?.("File tree initializing");
    await tree.exports.ready();

    tree.panel.headerVisible = false;

    dockAPI.onDidActivePanelChange((e) =>
      tree.exports.focus(
        e?.id ? filePanelTracker.path(parseInt(e.id)) : undefined,
      ),
    );

    await os.watch((change) => {
      const { path, action, type } = change;

      switch (action) {
        case "add":
        case "addDir":
          if (!tree.exports.find(path)) tree.exports.add(path, type);
          break;
        case "unlink":
          tree.exports.remove(path);
          const id = filePanelTracker.id(path);
          if (id === undefined) return;
          filePanelTracker.drop("path", path);
          const panel = dockAPI.getPanel(`${id}`);
          if (panel) dockAPI.removePanel(panel);
          break;
        case "unlinkDir":
          tree.exports.remove(path);
          break;
      }
    });
  }}
/>
