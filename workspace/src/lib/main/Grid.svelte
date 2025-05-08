<script lang="ts" module>
  import type { FileSystemTree } from "@webcontainer/api";
  import type { WithElements, WithOperatingSystem } from "./index.js";

  export type Props = {
    filesystem?: FileSystemTree;
    onReady?: () => void;
    os?: OperatingSystem;
  } & Pick<CreateOptions, "status"> &
    Pick<EditorProps, "onSave"> &
    Partial<WithElements & WithOperatingSystem>;
</script>

<script lang="ts">
  import { isDark } from "../mode.js";
  import Tree from "../file-tree/Tree.svelte";
  import {
    Editor,
    type EditorProps,
    takeAction,
    tryGetLanguageByFile,
    createAndRegisterFileSystemProvider,
  } from "../code-editor/index.js";
  import { type Props as PropsOf } from "../utils/ui-framework.js";
  import VsCodeWatermark from "../VSCodeWatermark.svelte";
  import MountedDiv from "../utils/MountedDiv.svelte";
  import {
    OperatingSystem,
    Terminal,
    type CreateOptions,
  } from "$lib/operating-system/index.js";
  import { defer } from "../utils/index.js";
  import {
    type PanelProps,
    DockView,
    PaneView,
    GridView,
    type WithViewOnReady,
  } from "@p-buddy/dockview-svelte";
  import FilePanelTracker from "../utils/FilePanelTracker.js";
  import "@xterm/xterm/css/xterm.css";
  import { iterateFilesystem } from "../utils/fs-helper.js";
  import { register } from "../context-menu/index.js";
  import { getItems as getTerminalContextItems } from "../operating-system/TerminalContext.svelte";
  import {
    animateEntry,
    animateExit,
    defaultDuration,
    panelConfig,
    type ViewsHelper,
  } from "$lib/utils/dockview.js";
  import type { IDisposable } from "@xterm/xterm";
  import { Tab as PortTab, Preview } from "$lib/ports/index.js";
  import { entry, isSymlink } from "$lib/code-editor/utils.js";

  let {
    filesystem,
    status,
    onReady,
    onSave,
    os = $bindable(),
    elements = $bindable(),
  }: Props = $props();

  elements ??= {};

  type Views = ViewsHelper<{
    Full: {
      type: "grid";
      tabs: typeof tabs;
      sidebar: typeof sidebar;
      terminals: typeof terminals;
    };
    Tabs: {
      type: "dock";
      Preview: typeof Preview;
      Editor: typeof Editor;
    };
    Sidebar: {
      type: "pane";
      Tree: typeof Tree;
    };
    Terminals: {
      type: "grid";
      terminal: typeof terminal;
    };
  }>;

  const mountTerminal = async (
    api: Views["Terminals"]["api"],
    terminal: Terminal,
    reference?: string,
  ) => {
    let fit: IDisposable;
    let config = panelConfig(api).id(terminal.id).size(0);
    if (reference) config.direction("right").reference(reference);
    const { panel } = await api.addSnippetPanel(
      "terminal",
      {
        onMount(element) {
          terminal.mount(element, defaultDuration + 200);
          register(element, {
            props: () =>
              getTerminalContextItems(
                os!,
                terminal,
                mountTerminal.bind(null, api),
                (onDropped) => {
                  fit.dispose();
                  terminal.fade("out", defaultDuration - 100);
                  animateExit(api, panel, onDropped);
                },
              ),
          });
        },
        style: "height: 100%; padding: 10px;",
      },
      config.options,
    );
    fit = panel.api.onDidDimensionsChange(() => terminal.fit());
    animateEntry(api, panel);
  };

  const onMainGridReady: Views["Full"]["onReady"] = async ({ api }) => {
    status?.("Creating operating system");
    os = await OperatingSystem.Create({
      filesystem,
      status,
      watch: true,
    });

    if (!os) throw new Error("Operating system not initialized");

    const { container } = os;
    const { fs } = container;

    const deferredAPI = {
      tabs: defer<Views["Tabs"]["api"]>(),
      sidebar: defer<Views["Sidebar"]["api"]>(),
    };

    status?.("Adding dock");
    const [tabsAPI, _tabs] = await Promise.all([
      deferredAPI.tabs.promise,
      api.addSnippetPanel("tabs", {
        onReady: ({ api }) => deferredAPI.tabs.resolve(api),
      }),
    ]);

    status?.("Adding terminal and left pane views");

    const config = {
      sidebar: panelConfig(api)
        .maximumWidth(800)
        .size(200)
        .direction("left")
        .reference(_tabs),
      terminals: panelConfig(api)
        .minimumHeight(100)
        .size(200)
        .direction("below")
        .reference(_tabs),
    };

    const [sidebarAPI, _, terminals] = await Promise.all([
      deferredAPI.sidebar.promise,
      api.addSnippetPanel(
        "sidebar",
        { onReady: ({ api }) => deferredAPI.sidebar.resolve(api) },
        config.sidebar.options,
      ),
      api.addSnippetPanel(
        "terminals",
        { onReady: ({ api }) => mountTerminal(api, os!.terminal) },
        config.terminals.options,
      ),
    ]);

    terminals.panel.api.onDidDimensionsChange(() =>
      os!.terminals.forEach((t) => t.fit()),
    );

    const addPreview = (url: string, title: string) =>
      tabsAPI!.addComponentPanel(
        "Preview",
        { url },
        panelConfig<"dock">()
          .title(title)
          .tabComponent("PortTab")
          .direction("right").options,
      );

    addPreview("", "Preview");

    let _preview: ReturnType<typeof addPreview>;

    container.on("error", (error) => {
      console.error(error);
    });

    container.on("server-ready", async (port, url) => {
      url = `${url}?${Date.now()}`;
      const title = `Port: ${port}`;
      if (_preview) (await _preview).panel.update({ params: { url, title } });
      else _preview = addPreview(url, title);
    });

    container.on("port", (port) => {
      console.log({ port });
    });

    const actionOnFile = (path: string) =>
      takeAction(tryGetLanguageByFile(path), {
        os: os!,
      });

    if (filesystem) iterateFilesystem(filesystem, actionOnFile);

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
    createAndRegisterFileSystemProvider(os);
    const tree = await sidebarAPI!.addComponentPanel(
      "Tree",
      {
        fs,
        onFileClick: async (file) => {
          const id = `${filePanelTracker.add(file.path)}`;
          (
            tabsAPI!.getPanel(id) ??
            (
              await tabsAPI!.addComponentPanel(
                "Editor",
                {
                  fs,
                  file,
                  onSave,
                },
                panelConfig<"dock">().id(id).title(file.name).options,
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
              actionOnFile(current);
              fs.writeFile(current, await fs.readFile(previous));
              await fs.rm(previous);

              const index = previous.lastIndexOf("/");
              const parent = index > 0 ? previous.slice(0, index) : "/";
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
      panelConfig<"pane">().title("Explorer").isExpanded(true).options,
    );

    tree.panel.headerVisible = false;

    status?.("Creating file system watcher");
    await os.watch(async (change) => {
      const { path, action, type } = change;

      let symlink = false;

      switch (action) {
        case "add":
          const _entry = await entry(fs, path);
          symlink = Boolean(_entry && isSymlink(_entry));
          actionOnFile(path);
        case "addDir":
          if (!tree.exports.find(path))
            tree.exports.add(path, symlink ? "symlink" : type);
          break;
        case "unlink":
          tree.exports.remove(path);
          const id = filePanelTracker.id(path);
          if (id === undefined) return;
          filePanelTracker.drop("path", path);
          const panel = tabsAPI.getPanel(`${id}`);
          if (panel) tabsAPI.removePanel(panel);
          break;
        case "unlinkDir":
          tree.exports.remove(path);
          break;
      }
    });

    status?.("File tree initializing");
    await tree.exports.ready();

    tabsAPI.onDidActivePanelChange((e) =>
      tree.exports.focus(
        e?.id ? filePanelTracker.path(parseInt(e.id)) : undefined,
      ),
    );

    onReady?.();
  };
</script>

{#snippet tabs({
  params,
}: PanelProps<
  "grid",
  WithViewOnReady<"dock", { Editor: typeof Editor; Preview: typeof Preview }>
>)}
  <div class="w-full h-full" bind:this={elements!.dock}>
    <DockView
      {...params}
      components={{ Editor, Preview }}
      tabs={{ components: { PortTab } }}
      watermark={{ component: VsCodeWatermark }}
    />
  </div>
{/snippet}

{#snippet sidebar({
  params,
}: PanelProps<"grid", WithViewOnReady<"pane", { Tree: typeof Tree }>>)}
  <div class="w-full h-full" bind:this={elements!.tree}>
    <PaneView components={{ Tree }} {...params} />
  </div>
{/snippet}

{#snippet terminal(props: PanelProps<"grid", PropsOf<typeof MountedDiv>>)}
  <MountedDiv {...props.params} />
{/snippet}

{#snippet terminals({
  params,
}: PanelProps<"grid", WithViewOnReady<"grid", { terminal: typeof terminal }>>)}
  <div class="w-full h-full" bind:this={elements!.terminals}>
    <GridView {...params} snippets={{ terminal }} orientation={"HORIZONTAL"} />
  </div>
{/snippet}

<GridView
  orientation={"HORIZONTAL"}
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ sidebar: sidebar, tabs: tabs, terminals }}
  proportionalLayout={false}
  onReady={onMainGridReady}
/>
