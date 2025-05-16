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

  const defaults = {
    file: "my-file",
    folder: "my-folder",
  };
</script>

<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  import { isDark } from "../mode.js";
  import {
    tabs,
    open as openTab,
    utils as tabUtils,
    type View as TabsView,
  } from "./Tabs.svelte";
  import {
    sidebar,
    open as openInSidebar,
    added as addedInSidebar,
    type View as SidebarView,
  } from "./Sidebar.svelte";
  import { terminals, open as openTerminal } from "./Terminals.svelte";
  import {
    type EditorProps,
    takeAction,
    tryGetLanguageByFile,
    createAndRegisterFileSystemProvider,
  } from "../code-editor/index.js";
  import {
    OperatingSystem,
    Commands,
    type CreateOptions,
    type IDisposable,
  } from "$lib/operating-system/index.js";
  import { defer } from "../utils/index.js";
  import { GridView } from "@p-buddy/dockview-svelte";
  import FilePanelTracker from "../utils/FilePanelTracker.js";
  import {
    pathWithNewName,
    iterateFilesystem,
    removeLocal,
    trySanitize,
    validName,
  } from "$lib/utils/fs.js";
  import { type Item } from "../context-menu/index.js";
  import { panelConfig } from "$lib/utils/dockview.js";
  import { Ports } from "$lib/ports/index.js";
  import { entry, isSymlink } from "$lib/utils/fs.js";
  import { nameEdit, iterate, type TFolder } from "$lib/file-tree/index.js";

  let {
    filesystem,
    status,
    onReady,
    onSave,
    os = $bindable(),
    elements = $bindable(),
  }: Props = $props();

  elements ??= {};
</script>

<GridView
  orientation={"HORIZONTAL"}
  className={isDark.current ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ sidebar, tabs, terminals }}
  proportionalLayout={false}
  onReady={async ({ api }) => {
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
      tabs: defer<TabsView["api"]>(),
      sidebar: defer<SidebarView["api"]>(),
    };

    status?.("Adding dock");
    const [tabsAPI, _tabs] = await Promise.all([
      deferredAPI.tabs.promise,
      api.addSnippetPanel("tabs", {
        onReady: ({ api }) => deferredAPI.tabs.resolve(api),
        elements,
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
        { onReady: ({ api }) => deferredAPI.sidebar.resolve(api), elements },
        config.sidebar.options,
      ),
      api.addSnippetPanel(
        "terminals",
        {
          elements,
          onReady: ({ api }) => {
            os!.onTerminal(async (terminal, reference) =>
              openTerminal(os!, api, terminal, reference?.id),
            );
            os!.addTerminal();
          },
        },
        config.terminals.options,
      ),
    ]);

    terminals.panel.api.onDidDimensionsChange(() =>
      os!.terminals.forEach((t) => t.fit()),
    );

    const ports = Ports.Create();

    container.on("error", (error) => {
      console.error("error", error);
    });

    const portsListProps: Parameters<typeof openInSidebar.portsList>[1] = {
      open: (port) => openTab.preview(tabsAPI, ports, port),
      ports,
    };

    container.on("port", async (port, type, url) => {
      switch (type) {
        case "open":
          const filter = tabUtils.previewPanelFilter(port);
          const existing = tabsAPI.panels.filter(filter);
          if (existing.length > 0) {
            ports.refresh(existing);
            ports.url(port, url);
            const params = tabUtils.uniquePreviewProps(url, port);
            for (const panel of existing) {
              panel.api.setTitle(`${port}`);
              panel.api.updateParameters(params);
            }
            const list = await openInSidebar.portsList(
              sidebarAPI,
              portsListProps,
            );
            existing[0].api.setActive();
            list.exports.select(port);
          } else {
            const [preview, list] = await Promise.all([
              openTab.preview(tabsAPI, ports, port, { url }),
              openInSidebar.portsList(sidebarAPI, portsListProps),
            ]);
            if (preview.panel.api.isActive) list.exports.select(port);
          }
          break;
        case "close":
          ports.remove(port);
          break;
      }
    });

    const actionOnFile = (path: string) =>
      takeAction(tryGetLanguageByFile(path), {
        os: os!,
      });

    if (filesystem) iterateFilesystem(filesystem, actionOnFile);

    const filePanelTracker = new FilePanelTracker();
    const commands = new Commands(os.container.fs);

    createAndRegisterFileSystemProvider(os);

    const validPath = async (desired: string) => {
      const entries = await fs.readdir(".");
      return validName(entries, desired);
    };

    status?.("Adding initial file tree");
    const { exports: tree } = await openInSidebar.fileTree(sidebarAPI, fs, {
      onFileClick: (path) => {
        commands.open(path);
      },
      onFileMouseEnter: (path) => {},
      onFileMouseLeave: (path) => {},
      rename: (name, item) => {
        if (name === item.name) return;
        const from = item.path;
        const to = pathWithNewName(name, item);
        const remap = { from, to }; // reuse to limit allocations
        switch (item.type) {
          case "folder":
            iterate(item as TFolder, ({ path, type }) => {
              if (type !== "file" && type !== "symlink") return;
              remap.from = path;
              remap.to = path.replace(from, to);
              filePanelTracker.tryRemap(remap);
            });
            break;
          case "file":
          case "symlink":
            filePanelTracker.tryRemap(remap);
            break;
        }
        commands.mv(from, to);
        item.name = name;
      },
      getItems: async (type, snippets, item) => {
        const terminal = await os!.terminal;
        let last: number | undefined;
        const suggest = (command: () => string | Promise<string>) => {
          let suggestion: IDisposable | undefined;
          const dispose = () => (suggestion?.dispose(), (last = Date.now()));
          return {
            onmouseenter: async () => {
              const fadeIn = Boolean(!last || Date.now() - last > 100);
              suggestion = terminal.suggest(await command(), fadeIn);
            },
            onmouseleave: dispose,
            onclick: async () => (
              dispose(), terminal.enqueueCommand(await command())
            ),
          };
        };

        if (type === "root") {
          return [
            {
              content: snippets.addFile,
              ...suggest(async () =>
                commands.touch(await validPath(defaults.file)),
              ),
            },
            {
              content: snippets.addFolder,
              ...suggest(async () =>
                commands.mkdir(await validPath(defaults.folder), true),
              ),
            },
          ];
        }

        const rename: Item = {
          content: snippets.rename,
          onclick: () => {
            const entry = tree.root.find(item!.path);
            if (entry)
              nameEdit.begin(entry, {
                override: entry.name,
                caretIndex: entry.name.split(".")[0].length,
              });
          },
        };

        switch (type) {
          case "file":
          case "symlink": {
            return [rename];
          }
          case "folder": {
            return [rename];
          }
        }
      },
    });

    container.on("xdg-open", async (text) => {
      const file = tree.root.find(removeLocal(trySanitize(text)));
      if (!file || file.type === "folder")
        throw new Error(`Can't open: ${text} (${file?.type ?? "not found"})`);
      openTab.code(tabsAPI, { file, fs, onSave }, filePanelTracker);
    });

    status?.("Creating file system watcher");
    await os.watch(async (change) => {
      const { path, action, type } = change;

      let symlink = false;

      switch (action) {
        case "add":
          actionOnFile(path);
          symlink = isSymlink(await entry(fs, path));
        case "addDir":
          const ancestors: TFolder[] = [];
          const parent = tree.root.findParent(path, ancestors);
          if (!parent) throw new Error(`Parent not found: ${path}`);
          if (!tree.root.find(path, parent)) {
            const item = tree.root.touch(path, symlink ? "symlink" : type);
            nameEdit.begin(item, { override: "" });
            for (const ancestor of ancestors) ancestor.expanded = true;
          }
          break;
        case "unlink":
          tree.root.rm(path);
          const id = filePanelTracker.id(path);
          if (id === undefined) return;
          filePanelTracker.drop("path", path);
          const panel = tabsAPI.getPanel(`${id}`);
          if (panel) tabsAPI.removePanel(panel);
          break;
        case "unlinkDir":
          tree.root.rm(path);
          break;
      }
    });

    tabsAPI.onDidActivePanelChange((e) => {
      const id = e?.id;
      tree.root.tryFocus(id ? filePanelTracker.path(parseInt(id)) : undefined);
      addedInSidebar.portsList?.exports.select(Ports.PanelIDToPort(id));
    });

    onReady?.();
  }}
/>
