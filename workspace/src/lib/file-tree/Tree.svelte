<script lang="ts" module>
  import type { WithLimitFsReturn } from "$lib/utils/fs.js";
  import type { DirEnt } from "@webcontainer/api";

  export type FsItemType = "file" | "folder" | "symlink";

  type EditingState = {
    condition: boolean;
    override?: string;
  };

  export type TBase<T extends FsItemType = FsItemType> = {
    type: T;
    name: string;
    editing: EditingState;
    get path(): string;
    remove: () => void;
  };

  type Focusable = { focused: boolean };

  export type TFile = TBase<"file"> & Focusable;
  export type TSymlink = TBase<"symlink"> & Focusable;

  export type TFolder = TBase<"folder"> & {
    expanded: boolean;
    children: (TFile | TFolder | TSymlink)[];
    drop(item: TTreeItem): boolean;
  };

  export type TFileLike = TFile | TSymlink;
  export type TTreeItem = TFile | TFolder | TSymlink;

  export type WithOnFile = Record<
    "onFileClick" | "onFileMouseEnter" | "onFileMouseLeave",
    (path: string) => void
  >;

  type Dirname = () => string;
  type WithDirname = { dirname: Dirname };

  export const join = (parent: string, child: string) =>
    parent ? `${parent}/${child}` : child;

  type BaseConfig<T extends FsItemType> = WithDirname &
    Pick<TBase<T>, "name" | "remove">;

  class Base<T extends FsItemType> implements TBase<T> {
    readonly type: T;
    readonly remove: () => void;
    readonly editing: EditingState = $state({
      condition: false,
      override: undefined,
    });

    name = $state("");

    private readonly getPath: () => string;

    get path(): string {
      return this.getPath();
    }

    constructor(type: T, { name, dirname, remove }: BaseConfig<T>) {
      this.type = type;
      this.name = name;
      this.remove = remove;
      this.getPath = () => join(dirname(), this.name);
    }
  }

  class File extends Base<"file"> implements TFile {
    focused = $state(false);

    constructor(options: BaseConfig<"file">) {
      super("file", options);
    }
  }

  class Symlink extends Base<"symlink"> implements TSymlink {
    focused = $state(false);

    constructor(options: BaseConfig<"symlink">) {
      super("symlink", options);
    }
  }

  class Folder extends Base<"folder"> implements TFolder {
    children = $state<TTreeItem[]>([]);
    expanded = $state(false);

    constructor(options: BaseConfig<"folder">) {
      super("folder", options);
    }

    drop(item: TTreeItem) {
      const index = this.children.indexOf(item);
      if (index === -1) return false;
      this.children.splice(index, 1)[0];
      return true;
    }
  }

  type Factory = {
    [k in FsItemType]: (
      options: BaseConfig<k>,
    ) => Extract<TTreeItem, { type: k }>;
  };

  const factory = {
    file: (options: BaseConfig<"file">) => new File(options),
    symlink: (options: BaseConfig<"symlink">) => new Symlink(options),
    folder: (options: BaseConfig<"folder">) => new Folder(options),
  } as const satisfies Factory;

  type LimitedFs = WithLimitFsReturn<
    "readdir",
    "isDirectory" | "name" | "isFile",
    { Await: true; Singular: true },
    { Promise: true; Array: true }
  >;

  const entryType = (entry: DirEnt<unknown>) =>
    entry.isDirectory() ? "folder" : entry.isFile() ? "file" : "symlink";

  const populate = async (fs: LimitedFs, parent: TFolder) => {
    const dirname = () => parent.path;
    for (const entry of await fs.readdir(parent.path, {
      withFileTypes: true,
    })) {
      const remove = () => parent.drop(item);
      const item = factory[entryType(entry)]({ ...entry, dirname, remove });
      if (item.type === "folder") await populate(fs, item);
      parent.children.push(item);
    }
  };

  type WithFs = { fs: Parameters<typeof populate>[0] };

  type Rename = (newName: string, path: string) => void;
  export type WithRename = { rename: Rename };

  const splitPath = (path: string) => {
    const parts = path.split("/");
    const name = parts.pop()!;
    return { dirname: parts.join("/"), name, parts };
  };
</script>

<script lang="ts">
  import FolderComponent from "./Folder.svelte";
  import FileComponent from "./File.svelte";
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import { onMount } from "svelte";
  import type { OnlyRequire } from "$lib/utils/index.js";
  import FsContextMenu, { type WithGetItems } from "./FsContextMenu.svelte";
  import { slide } from "svelte/transition";
  import { focusColor } from "./common.js";

  type Props = WithFs & WithOnFile & WithRename & WithGetItems;

  let { params }: OnlyRequire<PanelProps<"pane", Props>, "params"> = $props();

  const {
    fs,
    onFileClick,
    onFileMouseEnter,
    onFileMouseLeave,
    getItems,
    rename,
  } = params;

  const root = new Folder({
    name: "",
    dirname: () => "",
    remove: () => {
      throw new Error("root should not be removed");
    },
  });

  const populated = populate(fs, root);

  export const getRoot = () => populated.then(() => root);

  export const find = (path: string): TTreeItem | undefined => {
    if (path === root.name) return root;
    const { name, parts } = splitPath(path);

    let searchFolder: TFolder = root;
    let partIndex = 0;

    if (parts.length > 0)
      while (partIndex < parts.length) {
        const target = parts[partIndex];
        let found = false;
        for (const child of searchFolder.children)
          if (child.type === "folder" && child.name === target) {
            searchFolder = child;
            partIndex++;
            found = true;
            break;
          }
        if (!found) return undefined;
      }

    return searchFolder.children.find((child) => child.name === name);
  };

  export const add = (path: string, type: FsItemType, editOnMount = false) => {
    const { name, dirname } = splitPath(path);
    const parent = find(dirname);
    if (!parent || parent.type !== "folder")
      throw new Error("Parent not found");
    const item = factory[type]({
      name,
      dirname: () => parent.path,
      remove: () => parent.drop(item),
    });
    parent.children.push(item);
    if (editOnMount) {
      item.editing.condition = true;
      item.editing.override = "";
    }
    return item;
  };

  export const remove = (path: string, parent?: TFolder) => {
    const { name, dirname } = splitPath(path);
    parent ??= find(dirname) as TFolder;
    if (!parent || parent.type !== "folder") return false;
    const entry = parent.children.find((child) => child.name === name);
    if (!entry) return false;
    const result = parent.drop(entry);
    if (result && entry.type === "folder")
      for (const child of entry.children) remove(child.path, entry);
    return result;
  };

  let currentFocused: Extract<TTreeItem, Focusable> | undefined;

  export const focus = (path?: string) => {
    if (currentFocused) currentFocused.focused = false;
    if (!path) return;
    const item = find(path);
    if (!item || item.type === "folder") return;
    item.focused = true;
    currentFocused = item;
  };

  let container = $state<HTMLElement>();

  export const getContainer = () => container;

  export const ready = () => populated.then(() => true);

  onMount(() => {
    let parent = container!.parentElement;
    while (parent && !parent?.classList.contains("dv-pane-body"))
      parent = parent.parentElement;
    parent?.classList.add("override-no-focus-outline");
  });

  $effect(() => {
    root.children.sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<FsContextMenu target={container} atCursor={true} {getItems} type="root" />

<div
  class="w-full h-full flex flex-col z-50 p-2 shadow-md focus:before:outline-none"
  style:--focus-color={focusColor}
  bind:this={container}
>
  {#each root.children as child, index}
    <div transition:slide={{ duration: 300 }}>
      {#if child.type === "folder"}
        <FolderComponent
          folder={child}
          {rename}
          {getItems}
          {onFileClick}
          {onFileMouseEnter}
          {onFileMouseLeave}
        />
      {:else}
        <FileComponent
          file={child}
          {rename}
          {getItems}
          {onFileClick}
          {onFileMouseEnter}
          {onFileMouseLeave}
        />
      {/if}
    </div>
  {/each}
</div>

<style>
  :global(
      .override-no-focus-outline .override-no-focus-outline:focus:before,
      .override-no-focus-outline:focus-within:before
    ) {
    outline: none !important;
  }
</style>
