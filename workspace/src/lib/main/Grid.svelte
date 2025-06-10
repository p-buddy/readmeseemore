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
    TerminalCommands,
    type CreateOptions,
    type TerminalSuggestion,
  } from "$lib/operating-system/index.js";
  import { defer, remainsTrue, type Deferred } from "../utils/index.js";
  import { GridView } from "@p-buddy/dockview-svelte";
  import FilePanelTracker from "../utils/FilePanelTracker.js";
  import {
    pathWithNewName,
    iterateFilesystem,
    removeLocal,
    trySanitize,
    validName,
    dirname,
    walkFs,
    entryType,
  } from "$lib/utils/fs.js";
  import { type Item as ContextItem } from "../context-menu/index.js";
  import { panelConfig } from "$lib/utils/dockview.js";
  import { Ports } from "$lib/ports/index.js";
  import { entry, isSymlink } from "$lib/utils/fs.js";
  import {
    nameEdit,
    iterate,
    type TFolder,
    type TTreeItem,
  } from "$lib/file-tree/index.js";
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
    const commands = new TerminalCommands(os.container.fs);

    createAndRegisterFileSystemProvider(os);

    const validNameAt = async (desired: string, parent?: string) => {
      const dir = !parent || parent === "" ? "." : parent;
      const entries = await fs.readdir(dir);
      return validName(entries, desired);
    };

    status?.("Adding initial file tree");

    let awaitingTerminal: Promise<Terminal> | undefined;
    let suggestionTerminalCreationLock: Deferred | undefined;
    const lockSuggestionTerminalCreationOnClick = {
      before: () => (suggestionTerminalCreationLock = defer()),
      after: () => {
        suggestionTerminalCreationLock!.resolve();
        suggestionTerminalCreationLock = undefined;
      },
    };
    const getTerminal = async () => {
      let terminal = os!.inputlessTerminal ?? os!.nonExecutingTerminal;
      if (!terminal) {
        if (suggestionTerminalCreationLock)
          await suggestionTerminalCreationLock.promise;
        awaitingTerminal ??= os!.addTerminal();
        const promise = awaitingTerminal;
        terminal = await promise;
        if (awaitingTerminal === promise) awaitingTerminal = undefined;
      }
      terminal.scrollToBottom();
      return terminal;
    };

    let addedViaContext = new Map<string, Deferred>();
    let editAfterAddViaContext: Set<string> = new Set();

    const suggestOpen = nonFlickeringSuggestionScope(
      lockSuggestionTerminalCreationOnClick,
    );

    let renameTerminal: Terminal | undefined;
    let renameSuggestion: TerminalSuggestion | undefined;
    let hoveredFile: string | undefined;
    const isCurrentFile = (file: Pick<TTreeItem, "path">) =>
      file.path === hoveredFile;

    const { exports: tree } = await openInSidebar.fileTree(sidebarAPI, fs, {
      onFileClick: async (file) => {
        const terminal = await remainsTrue(
          () => isCurrentFile(file),
          getTerminal,
        );
        if (!terminal) return;
        suggestOpen.onclick(commands.open(file.path), terminal);
      },
      onFileMouseEnter: async (file) => {
        if (file.editing.condition) return suggestOpen.onmouseleave();
        hoveredFile = file.path;
        // TODO: This actualy shouldn't fire if a rename editing is in progress nor if a rename is in progress
        const renaming = addedViaContext?.get(file.path);
        if (renaming) await renaming.promise;
        if (hoveredFile !== file.path) return;
        const terminal = await getTerminal();
        if (hoveredFile !== file.path) return;
        suggestOpen.onmouseenter(commands.open(file.path), terminal);
      },
      onFileMouseLeave: (file) => {
        if (file.path === hoveredFile) hoveredFile = undefined;
        suggestOpen.onmouseleave();
      },
      validate: async (item, value, rect, done) => {
        if (done) {
          renameSuggestion?.dispose();
          renameSuggestion = undefined;
          renameTerminal = undefined;
          return checkFileNameAtLocation(value, item, tree.root).status;
        }
        renameTerminal ??= await getTerminal();
        await renameTerminal.doneExecuting;
        renameTerminal.scrollToBottom();
        renameSuggestion ??= renameTerminal.suggest(
          commands.mv(item.path, pathWithNewName(value, item)),
          { pin: true },
        );
        const isEditingAfterAdd = editAfterAddViaContext.has(item.path);
        if (isEditingAfterAdd) editAfterAddViaContext.delete(item.path);

        const desired = pathWithNewName(value, item);
        const cmd = commands.mv(item.path, desired);

        const check = isEditingAfterAdd
          ? undefined
          : checkFileNameAtLocation(
              value,
              item,
              tree.root,
              destinationIndexFromMv(cmd) +
                (item.path.length - item.name.length),
            );
        renameSuggestion?.exports?.update(cmd, check?.annotations, rect);
        return check?.status ?? "valid";
      },
      rename: (name, item) => {
        const terminal = renameTerminal;
        renameTerminal = undefined;
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
        (terminal?.doneExecuting ?? getTerminal()).then((terminal) =>
          terminal.enqueueCommand(commands.mv(from, to)),
        );
      },
      getContextItems: async (type, snippets, item) => {
        const terminal = await getTerminal();
        const suggest = dynamicNonFlickeringSuggestionScope(
          terminal,
          lockSuggestionTerminalCreationOnClick,
        );
        type SuggestCallback = Parameters<typeof suggest>[0];

        const add =
          (type: keyof typeof defaults, parent?: string): SuggestCallback =>
          async (condition) => {
            const name = await validNameAt(defaults[type], parent);
            parent ??= parent ? parent + "/" : "";
            const path = parent + name;
            if (condition === "click") {
              renameTerminal = terminal;
              addedViaContext.set(path, defer());
            }
            return type === "file"
              ? commands.touch(path)
              : commands.mkdir(path, true);
          };

        if (type === "root") {
          return [
            {
              content: snippets.addFile,
              ...suggest(add("file")),
            },
            {
              content: snippets.addFolder,
              ...suggest(add("folder")),
            },
          ];
        }

        if (!item) throw new Error("No item to create file-tree context menu");

        const { onmouseenter: onRenameEnter, onmouseleave: onRenameLeave } =
          suggest(commands.mv(item.path, "..."));

        const rename: ContextItem = {
          content: snippets.rename,
          onmouseenter: onRenameEnter,
          onmouseleave: onRenameLeave,
          onclick: () => {
            onRenameLeave();
            nameEdit.begin(item, {
              override: item.name,
              caretIndex: item.name.split(".")[0].length,
            });
          },
        };

        const isDirectory = type === "folder";

        const duplicate: ContextItem = {
          ...suggest(async (condition) => {
            const parent = dirname(item.path);
            const path = removeLocal(
              parent + "/" + (await validNameAt(item.name, parent)),
            );
            if (condition === "click") {
              renameTerminal = terminal;
              addedViaContext.set(path, defer());
            }
            return commands.cp(item.path, path, isDirectory);
          }),
          content: snippets.copyFile,
        };

        switch (type) {
          case "file":
          case "symlink": {
            const base = [rename, duplicate];

            return [rename, duplicate];
          }
          case "folder": {
            const addFile: ContextItem = {
              content: snippets.addFile,
              ...suggest(add("file", item.path)),
            };
            const addFolder: ContextItem = {
              content: snippets.addFolder,
              ...suggest(add("folder", item.path)),
            };
            return [rename, addFile, addFolder, duplicate];
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
          if (!path.includes("node_modules")) actionOnFile(path);
          symlink = isSymlink(await entry(fs, path));
        case "addDir":
          const adding = addedViaContext.get(path);
          adding?.resolve();
          addedViaContext.delete(path);
          const predecessors: TFolder[] = [];
          const parent = tree.root.findParent(path, predecessors);
          if (!parent) throw new Error(`Parent not found: ${path}`);
          if (tree.root.find(path, parent)) break;
          const item = tree.root.touch(path, symlink ? "symlink" : type);
          if (!adding) break;
          editAfterAddViaContext.add(path);
          nameEdit.begin(item, { override: "" });
          for (const predecessor of predecessors) predecessor.expanded = true;
          if (action === "addDir")
            walkFs(
              fs,
              (p, entry) => tree.root.touch(removeLocal(p), entryType(entry)),
              path,
            );
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
