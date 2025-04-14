<script lang="ts">
  import { isDark } from "./mode.js";
  import Tree from "./file-tree/Tree.svelte";
  import Editor from "./editor/Editor.svelte";
  import { type Props as PropsOf } from "./utils/ui-framework.js";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
  import { type FileSystemTree, type BufferEncoding } from "@webcontainer/api";
  import MountedDiv from "./utils/MountedDiv.svelte";
  import OperatingSystem, { type CreateOptions } from "$lib/OperatingSystem.js";
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
  import "@xterm/xterm/css/xterm.css";

  type Props = {
    filesystem?: FileSystemTree;
    onReady?: () => void;
  } & Pick<CreateOptions, "status">;

  let { filesystem, status, onReady }: Props = $props();

  let os = $state<OperatingSystem>();

  $effect(() => {
    if (!os) return;
    const { xterm } = os;
    xterm.options.theme = isDark.current
      ? { background: "#181818" }
      : { background: "#f3f3f3", foreground: "#000", cursor: "#666" };
    xterm.refresh(0, xterm.rows - 1);
  });

  const sanitize = (path: string) => {
    while (path.startsWith("/")) path = path.slice(1);
    return path;
  };

  export const writeFile = (path: string, content = "") =>
    os!.container.fs.writeFile(sanitize(path), content);

  export const readFile = (path: string, encoding: BufferEncoding = "utf-8") =>
    os!.container.fs.readFile(sanitize(path), encoding);

  export const updateFilesystem = async (
    filesystem: FileSystemTree,
    path = "",
  ) => {
    for (const [key, value] of Object.entries(filesystem))
      if ("directory" in value)
        await updateFilesystem(value.directory, `${path}/${key}`);
      else if ("file" in value)
        if ("contents" in value.file && typeof value.file.contents === "string")
          await writeFile(`${path}/${key}`, value.file.contents);
  };

  export const OS = <TRequire extends boolean = true>(
    require = true as TRequire,
  ): TRequire extends true ? OperatingSystem : OperatingSystem | undefined => {
    if (!os && require) throw new Error("Operating system not initialized");
    return os!;
  };
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

<section class="w-full h-full">
  <GridView
    orientation={Orientation.HORIZONTAL}
    className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
    snippets={{ pane, dock, terminal }}
    proportionalLayout={false}
    onReady={async ({ api }) => {
      status?.("Creating operating system");
      os = await OperatingSystem.Create({ filesystem, status, watch: true });

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

      status?.("Adding terminal and left pane views");
      const [paneAPI, _, terminal] = await Promise.all([
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
            style: "height: 100%; padding: 10px;",
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

      const rm = async (path: string) => {
        fs.rm(path, { recursive: true });
        pending.rm.delete(path);
      };

      const dir = {
        empty: async (path: string) => (await fs.readdir(path)).length === 0,
        tryRemoveEmpty: async (path: string) => {
          if (!(await dir.empty(path))) return false;
          rm(path);
          return true;
        },
      };

      status?.("Adding initial file tree");
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
                  {
                    fs,
                    file,
                    onSave: ({ path }) => {
                      if (path.endsWith(".ts")) {
                        const command = `npx --yes tsx ${path}`;
                        os!.enqueueCommand(command);
                      }
                    },
                  },
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
                if (!(await dir.tryRemoveEmpty(previous)))
                  pending.rm.add(previous);
                break;
              case "file":
                fs.writeFile(current, await fs.readFile(previous));
                await fs.rm(previous);

                const parent = previous.split("/").slice(0, -1).join("/");
                if (pending.rm.has(parent)) dir.tryRemoveEmpty(parent);

                if (!filePanelTracker.has("path", previous)) return;
                filePanelTracker.set(current, filePanelTracker.id(previous)!);
                filePanelTracker.drop("path", previous);
                break;
            }
          },
          write: (type, path) =>
            type === "file" ? fs.writeFile(path, "") : fs.mkdir(path),
        },
        {
          title: "Explorer",
          isExpanded: true,
        },
      );

      tree.panel.headerVisible = false;

      status?.("Creating file system watcher");
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

      status?.("File tree initializing");
      await tree.exports.ready();

      dockAPI.onDidActivePanelChange((e) =>
        tree.exports.focus(
          e?.id ? filePanelTracker.path(parseInt(e.id)) : undefined,
        ),
      );

      onReady?.();
    }}
  />
</section>

<style>
  section {
    font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-weight: 400;

    color-scheme: dark;
    background-color: #181818;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }
</style>
