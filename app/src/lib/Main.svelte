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
  import {
    type WithViewOnReady,
    type PanelProps,
    type ViewAPI,
    DockView,
    PaneView,
    GridView,
    Orientation,
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
    os.container.on("server-ready", async (port, url) => {});

    const fileIDHelper = {
      count: 0,
      idByPath: new Map<string, number>(),
      pathById: new Array<string>(),
      get(path: string) {
        const id = this.idByPath.get(path) ?? this.count++;
        this.set(path, id);
        return id;
      },
      set(path: string, id: number) {
        this.idByPath.set(path, id);
        this.pathById[id] = path;
      },
    };

    const { fs } = os.container;
    fs.writeFile("/index.ts", "const x = 1;");

    const pending = {
      rm: new Set<string>(),
    };

    const tree = await paneAPI!.addComponentPanel(
      "Tree",
      {
        fs: os.container.fs,
        onFileClick: async (file) => {
          const id = `${fileIDHelper.get(file.path)}`;
          (
            dockAPI!.getPanel(id) ??
            (
              await dockAPI!.addComponentPanel(
                "Editor",
                {
                  fs: os!.container.fs,
                  file,
                },
                { id, title: file.name },
              )
            ).panel
          ).api.setActive();
        },
        onPathUpdate: async ({ current, previous, type }) => {
          console.log("onPathUpdate", current, previous, type);
          switch (type) {
            case "folder":
              fs.mkdir(current);
              (await fs.readdir(previous)).length === 0
                ? fs.rm(previous, { recursive: true })
                : pending.rm.add(previous);
              break;
            case "file":
              fs.writeFile(current, await fs.readFile(previous));
              await fs.rm(previous);

              const parent = previous.split("/").slice(0, -1).join("/");
              if (
                pending.rm.has(parent) &&
                (await fs.readdir(parent)).length === 0
              ) {
                fs.rm(parent, { recursive: true });
                pending.rm.delete(parent);
              }

              if (!fileIDHelper.idByPath.has(previous)) return;
              fileIDHelper.set(current, fileIDHelper.idByPath.get(previous)!);
              fileIDHelper.idByPath.delete(previous);
              break;
          }
        },
      },
      {
        title: "Explorer",
        isExpanded: true,
      },
    );

    tree.panel.headerVisible = false;

    dockAPI.onDidActivePanelChange((e) => {
      const id = e?.id;
      id === undefined
        ? tree.exports.setFocused()
        : tree.exports.setFocused(fileIDHelper.pathById[parseInt(id)]);
    });

    os.onFsChange((change) => {
      switch (change.action) {
        case "add":
        case "addDir":
          if (!tree.exports.find(change.path))
            tree.exports.add(change.path, change.type);
          break;
        case "unlink":
        case "unlinkDir":
          console.log(change);
          break;
      }
    });
  }}
/>
