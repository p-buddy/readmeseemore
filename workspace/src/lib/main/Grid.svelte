<script lang="ts" module>
  import type { FileSystemTree } from "@webcontainer/api";
  import type { WithElements, WithOperatingSystem } from "./index.js";

  export type Props = {
    filesystem?: FileSystemTree;
    onReady?: () => void;
    os?: OperatingSystem;
  } & Pick<CreateOptions, "status"> &
    Partial<WithElements & WithOperatingSystem>;
</script>

<script lang="ts">
  import { isDark } from "../mode.js";
  import Tree from "../file-tree/Tree.svelte";
  import Editor from "../editor/Editor.svelte";
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
    type WithViewOnReady,
    type PanelProps,
    type ViewAPI,
    DockView,
    PaneView,
    GridView,
  } from "@p-buddy/dockview-svelte";
  import FilePanelTracker from "../utils/FilePanelTracker.js";
  import "@xterm/xterm/css/xterm.css";
  import { takeAction } from "../editor/actions.js";
  import { tryGetLanguageByFile } from "../editor/index.js";
  import { createAndRegisterFileSystemProvider } from "../editor/file-system-provider.js";
  import { iterateFilesystem } from "../utils/fs-helper.js";
  import { register } from "../context-menu/index.js";
  import { getItems as getTerminalContextItems } from "../operating-system/TerminalContext.svelte";
  import {
    animateEntry,
    animateExit,
    defaultDuration,
  } from "$lib/utils/dockview.js";
  import type { IDisposable } from "@xterm/xterm";

  let {
    filesystem,
    status,
    onReady,
    os = $bindable(),
    elements = $bindable(),
  }: Props = $props();

  elements ??= {};
</script>

{#snippet preview({ params: { url } }: PanelProps<"dock", { url: string }>)}
  {/* @ts-ignore */ null}
  <iframe src={url} title="preview" class="w-full h-full"> </iframe>
{/snippet}

{#snippet dock({
  params,
}: PanelProps<
  "grid",
  WithViewOnReady<"dock", { preview: typeof preview; Editor: typeof Editor }>
>)}
  <div class="w-full h-full" bind:this={elements!.dock}>
    <DockView
      {...params}
      snippets={{ preview }}
      components={{ Editor }}
      watermark={{ component: VsCodeWatermark }}
    />
  </div>
{/snippet}

{#snippet pane({
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
  snippets={{ pane, dock, terminals }}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    status?.("Creating operating system");
    os = await OperatingSystem.Create({
      filesystem,
      status,
      watch: true,
    });

    const { container } = os;
    const { fs } = container;

    if (!os) throw new Error("Operating system not initialized");

    type DockComponents = {
      Editor: typeof Editor;
      preview: typeof preview;
    };
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
    const [paneAPI, _, terminals] = await Promise.all([
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
        "terminals",
        {
          onReady: async ({ api }) => {
            const mountTerminal = async (
              terminal: Terminal,
              referencePanel?: string,
            ) => {
              let fit: IDisposable;
              const { panel } = await api.addSnippetPanel(
                "terminal",
                {
                  onMount(element) {
                    terminal.mount(element, defaultDuration + 200);
                    register(element, {
                      props: () => ({
                        items: getTerminalContextItems(
                          os!,
                          terminal,
                          mountTerminal,
                          (onDropped) => {
                            fit.dispose();
                            terminal.fade("out", defaultDuration - 100);
                            animateExit(api, panel, onDropped);
                          },
                        ),
                      }),
                    });
                  },
                  style: "height: 100%; padding: 10px;",
                },
                {
                  id: terminal.id,
                  size: 0,
                  position: referencePanel
                    ? {
                        direction: "right",
                        referencePanel,
                      }
                    : undefined,
                },
              );
              fit = panel.api.onDidDimensionsChange(() => terminal.fit());
              animateEntry(api, panel);
            };

            mountTerminal(os!.terminal);
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

    terminals.panel.api.onDidDimensionsChange(() =>
      os!.terminals.forEach((t) => t.fit()),
    );

    const addPreview = (url: string, title: string) =>
      dockAPI!.addSnippetPanel(
        "preview",
        {
          url,
        },
        {
          title,
          position: {
            direction: "right",
          },
        },
      );

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
                      os!.terminal.enqueueCommand(command);
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
          actionOnFile(path);
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

<style>
  :global(.my-dockview-theme .dv-groupview, .my-dockview-theme .dv-paneview) {
    /* animate both dimension changes */
    transition:
      width 0.3s ease-in-out,
      height 0.3s ease-in-out;
  }
</style>
