<script lang="ts" module>
  import type { WithLimitFsReturn } from "$lib/utils/fs-helper.js";

  type FsItemType = "file" | "folder";

  type ForceRename = { dirnameOverride: string };

  export type TBase<T extends FsItemType = FsItemType> = {
    name: string;
    type: T;
    get path(): string;
    focused?: boolean;
    rename: (update: string, force?: ForceRename) => boolean;
    remove: () => void;
  };

  export type TFile = TBase<"file">;
  export type TFolder = TBase<"folder"> & {
    children: (TFile | TFolder)[];
    expanded?: boolean;
    drop(item: TTreeItem, callback?: OnRemove): boolean;
  };
  export type TTreeItem = TFile | TFolder;

  export type WithOnFileClick = { onFileClick: (file: TFile) => void };

  type OnPathUpdate = (update: {
    current: string;
    previous: string;
    type: FsItemType;
  }) => void;
  export type WithOnPathUpdate = { onPathUpdate: OnPathUpdate };

  type OnRemove = (item: TTreeItem) => void;
  export type WithOnRemove = { onRemove: OnRemove };

  type OnAdd = (item: TTreeItem) => void;
  export type WithOnAdd = { onAdd: OnAdd };

  type Write = (type: FsItemType, path: string) => Promise<void>;
  export type WithWrite = { write: Write };

  type Dirname = () => string;
  type WithDirname = { dirname: Dirname };

  export const join = (parent: string, child: string) =>
    parent ? `${parent}/${child}` : child;

  type BaseConfig<T extends FsItemType = FsItemType> = WithOnPathUpdate &
    WithDirname &
    Pick<TBase<T>, "remove" | "name" | "type">;

  class Base<T extends FsItemType> implements TBase<T> {
    readonly type: T;
    name = $state("");
    focused = $state<boolean>();
    readonly remove: () => void;

    private readonly getPath: () => string;
    private readonly onPathUpdate: OnPathUpdate;

    get path(): string {
      return this.getPath();
    }

    constructor({ type, name, dirname, onPathUpdate, remove }: BaseConfig<T>) {
      this.type = type;
      this.name = name;
      this.getPath = () => join(dirname(), this.name);
      this.onPathUpdate = onPathUpdate;
      this.remove = remove;
    }

    rename(update: string, force?: ForceRename) {
      let previousPath = this.path;
      const renamed = update !== this.name;
      if (renamed) this.name = update;
      if (force?.dirnameOverride)
        previousPath = join(force?.dirnameOverride, this.name);

      if (renamed || force?.dirnameOverride)
        this.onPathUpdate?.({
          current: this.path,
          previous: previousPath,
          type: this.type,
        });

      return renamed;
    }
  }

  type Rename = Base<FsItemType>["rename"];

  class Folder extends Base<"folder"> implements TFolder {
    children = $state<TTreeItem[]>([]);
    expanded = $state(false);

    constructor(options: Omit<BaseConfig<"folder">, "type">) {
      super({ ...options, type: "folder" });
    }

    rename(update: string, force?: ForceRename) {
      const previousPath = this.path;
      const renamed = super.rename(update);
      if (renamed || force?.dirnameOverride)
        for (const child of this.children)
          child.rename(child.name, {
            dirnameOverride: force?.dirnameOverride
              ? join(force?.dirnameOverride, child.name)
              : previousPath,
          });

      return renamed;
    }

    drop(item: TTreeItem, callback?: OnRemove) {
      const index = this.children.indexOf(item);
      if (index === -1) return false;
      const removed = this.children.splice(index, 1)[0];
      callback?.(removed);
      return true;
    }
  }

  const make = <T extends FsItemType>(
    type: T,
    options: Omit<BaseConfig<T>, "type">,
  ) => {
    type Return<T extends FsItemType> = TTreeItem & { type: T };
    if (type === "folder") return new Folder(options) as Return<"folder">;
    (options as BaseConfig<T>).type = type;
    return new Base(options as BaseConfig<T>) as Return<T>;
  };

  type LimitedFs = WithLimitFsReturn<
    "readdir",
    "isDirectory" | "name",
    { Await: true; Singular: true },
    { Promise: true; Array: true }
  >;

  const populate = async (
    fs: LimitedFs,
    parent: TFolder,
    callbacks: WithOnPathUpdate & WithOnRemove,
  ) => {
    const { onPathUpdate, onRemove } = callbacks;
    for (const entry of await fs.readdir(parent.path, {
      withFileTypes: true,
    })) {
      const item = make(entry.isDirectory() ? "folder" : "file", {
        name: entry.name,
        dirname: () => parent.path,
        onPathUpdate,
        remove: () => parent.drop(item, onRemove),
      });
      if (item.type === "folder") await populate(fs, item, callbacks);
      parent.children.push(item);
    }
  };

  type WithFs = { fs: Parameters<typeof populate>[0] };

  const splitPath = (path: string) => {
    const parts = path.split("/");
    const name = parts.pop()!;
    return { dirname: parts.join("/"), name, parts };
  };

  export const tryRenameAt = (
    children: TTreeItem[],
    index: number,
    ...[name, force]: Parameters<Rename>
  ) => {
    if (!name) return false;
    for (let i = 0; i < children.length; i++)
      if (i !== index && children[i].name === name) return false;
    return children[index].rename(name, force);
  };

  const validName = (children: TTreeItem[], type: FsItemType) => {
    let candidate: string = type;
    let index = 0;
    while (children.some((child) => child.name === candidate))
      candidate = `${type}(${++index})`;
    return candidate;
  };

  export const writeChild = (
    children: TTreeItem[],
    type: FsItemType,
    path: string,
    write: Write,
  ) => write(type, join(path, validName(children, type)));
</script>

<script lang="ts">
  import FolderComponent from "./Folder.svelte";
  import FileComponent from "./File.svelte";
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import { onMount } from "svelte";
  import type { OnlyRequire } from "$lib/utils/index.js";
  import FsContextMenu from "./FsContextMenu.svelte";

  type Props = WithFs &
    WithOnFileClick &
    WithOnPathUpdate &
    WithOnRemove &
    WithWrite;

  let { params }: OnlyRequire<PanelProps<"pane", Props>, "params"> = $props();

  const { fs, onFileClick, onPathUpdate, onRemove, write } = params;

  const root = new Folder({
    name: "",
    dirname: () => "",
    onPathUpdate: () => {
      throw new Error("root should not be updated");
    },
    remove: () => {
      throw new Error("root should not be removed");
    },
  });

  const populated = populate(fs, root, params);

  export const getRoot = () => populated.then(() => root);

  export const find = (path: string): TTreeItem | undefined => {
    if (path === root.name) return root;
    const { name, parts } = splitPath(path);

    let searchFolder: TFolder = root;
    let partIndex = 0;

    while (partIndex < parts.length)
      for (const child of searchFolder.children)
        if (child.type === "folder" && child.name === parts[partIndex]) {
          searchFolder = child;
          partIndex++;
          break;
        }

    return searchFolder.children.find((child) => child.name === name);
  };

  export const add = (path: string, type: FsItemType) => {
    const { name, dirname } = splitPath(path);
    const parent = find(dirname);
    if (!parent || parent.type !== "folder")
      throw new Error("Parent not found");
    const item = make(type, {
      name,
      onPathUpdate,
      dirname: () => parent.path,
      remove: () => parent.drop(item, onRemove),
    });
    parent.children.push(item);
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

  let currentFocused: TTreeItem | undefined;
  export const focus = (path?: string) => {
    if (currentFocused) currentFocused.focused = false;
    if (!path) return;
    const item = find(path);
    if (!item) return;
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

<FsContextMenu
  addFile={() => writeChild(root.children, "file", "", write)}
  addFolder={() => writeChild(root.children, "folder", "", write)}
  target={container}
  atCursor={true}
/>

<div
  class="w-full h-full flex flex-col z-50 p-2 shadow-md focus:before:outline-none"
  bind:this={container}
>
  {#each root.children as child, index}
    {@const rename: Rename = (...args) => tryRenameAt(root.children, index, ...args)}
    {#if child.type === "folder"}
      <FolderComponent
        {...child}
        {rename}
        {onFileClick}
        {write}
        bind:name={child.name}
      />
    {:else}
      {@const onclick = () => onFileClick(child)}
      <FileComponent {...child} {rename} {onclick} bind:name={child.name} />
    {/if}
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
