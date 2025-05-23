<script lang="ts" module>
  import type { FileSystemTree } from "@webcontainer/api";
  import type { WithElements, WithOperatingSystem } from "./index.js";
  import { type Terminal } from "$lib/operating-system/index.js";

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

  const mvPrefixLength = (cmd: string) => {
    const [mv, from, to] = cmd.split(" ");
    const length = mv.length + from.length + 2;
    return to?.startsWith('"') ? length + 1 : length;
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
    type TerminalSuggestion,
  } from "$lib/operating-system/index.js";
  import { defer, type Deferred } from "../utils/index.js";
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
  import {
    nonFlickeringSuggestionScope,
    dynamicNonFlickeringSuggestionScope,
    destinationIndexFromMv,
  } from "./common.svelte.js";
  import { checkFileNameAtLocation } from "$lib/file-tree/ItemNameAnnotations.svelte";

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

    // Can turn into a set of strings
    let addInProgress = new Map<string, Deferred>();

    status?.("Adding initial file tree");

    const getUserVisibleTerminal = async () => {
      const terminal = await os!.terminal;
      terminal.scrollToBottom();
      return terminal;
    };

    const suggestOpen = nonFlickeringSuggestionScope();

    const { exports: tree } = await openInSidebar.fileTree(sidebarAPI, fs, {
      onFileClick: async (file) => {
        const terminal = await getUserVisibleTerminal();
        suggestOpen.onclick(commands.open(file.path), terminal);
      },
      onFileMouseEnter: async (file) => {
        if (file.editing.condition) return suggestOpen.onmouseleave();
        // TODO: This actualy shouldn't fire if a rename editing is in progress nor if a rename is in progress
        const renaming = addInProgress?.get(file.path);
        if (renaming) await renaming.promise;
        const terminal = await getUserVisibleTerminal();
        suggestOpen.onmouseenter(commands.open(file.path), terminal);
      },
      onFileMouseLeave: suggestOpen.onmouseleave,
      rename: (name, item) => {
        if (name === item.name) return;
        if (name === "" || name.trim() === "") return;
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
        item.name = name;
        addInProgress.get(item.path)?.resolve();
        addInProgress.set(item.path, defer());
        getUserVisibleTerminal().then((terminal) =>
          terminal.enqueueCommand(commands.mv(from, to)),
        );
      },
      getItems: async (type, snippets, item) => {
        const terminal = await getUserVisibleTerminal();
        const suggest = dynamicNonFlickeringSuggestionScope(terminal);

        if (type === "root") {
          return [
            {
              content: snippets.addFile,
              ...suggest(async (condition) => {
                const path = await validPath(defaults.file);
                if (condition === "click") addInProgress.set(path, defer());
                return commands.touch(path);
              }),
            },
            {
              content: snippets.addFolder,
              ...suggest(async (condition) => {
                const path = await validPath(defaults.folder);
                if (condition === "click") addInProgress.set(path, defer());
                return commands.mkdir(path, true);
              }),
            },
          ];
        }

        if (!item) throw new Error("No item to create file-tree context menu");

        const renameSuggest = suggest(commands.mv(item.path, "..."));

        const rename: Item = {
          content: snippets.rename,
          ...renameSuggest,
          onclick: () => {
            renameSuggest.onmouseleave();
            const suggestion = terminal.suggest(
              commands.mv(item.path, item.path),
              false,
            );
            nameEdit.begin(item, {
              override: item.name,
              caretIndex: item.name.split(".")[0].length,
              callback: (value, done) => {
                const desired = pathWithNewName(value, item);
                const cmd = commands.mv(item.path, desired);
                const { annotations, status } = checkFileNameAtLocation(
                  value,
                  item,
                  tree.root,
                  destinationIndexFromMv(cmd),
                );
                done
                  ? suggestion?.dispose()
                  : suggestion?.exports?.update(cmd, annotations);
                return status;
              },
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
          const adding = addInProgress.get(path);
          if (adding) {
            adding.resolve();
            addInProgress.delete(path);
          }
          const ancestors: TFolder[] = [];
          const parent = tree.root.findParent(path, ancestors);
          if (!parent) throw new Error(`Parent not found: ${path}`);
          if (tree.root.find(path, parent)) break;
          else if (!adding) tree.root.touch(path, symlink ? "symlink" : type);
          else {
            // Tree item doesn't exist, and it's been noted it's beind added
            const item = tree.root.touch(path, symlink ? "symlink" : type);

            let renameSuggestion: TerminalSuggestion | undefined;
            let terminal: Terminal | undefined;
            let initial = true;
            nameEdit.begin(item, {
              override: "",
              callback: async (value, done) => {
                if (done) {
                  renameSuggestion?.dispose();
                  return checkFileNameAtLocation(value, item, tree.root).status;
                }
                terminal ??= await getUserVisibleTerminal();
                renameSuggestion ??= terminal.suggest(
                  commands.mv(item.path, pathWithNewName(value, item)),
                );
                const isFirstCallback = initial;
                initial = false;
                const desired = pathWithNewName(value, item);
                const cmd = commands.mv(item.path, desired);
                const check = isFirstCallback
                  ? undefined
                  : checkFileNameAtLocation(
                      value,
                      item,
                      tree.root,
                      destinationIndexFromMv(cmd),
                    );
                renameSuggestion?.exports?.update(cmd, check?.annotations);
                return check?.status ?? "valid";
              },
            });
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
