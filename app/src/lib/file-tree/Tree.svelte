<script lang="ts" module>
  import type { WithLimitFsReturn } from "$lib/utils/fs-helper";

  type FsItemType = "file" | "folder";

  type ForceRename = { dirnameOverride: string };

  export type TBase<T extends FsItemType = FsItemType> = {
    name: string;
    type: T;
    get path(): string;
    focused?: boolean;
    rename: (update: string, force?: ForceRename) => boolean;
    delete: () => void;
  };

  export type TFile = TBase<"file">;
  export type TFolder = TBase<"folder"> & {
    children: (TFile | TFolder)[];
    expanded?: boolean;
  };
  export type TTreeItem = TFile | TFolder;

  export type WithOnFileClick = { onFileClick: (file: TFile) => void };

  type OnPathUpdate = (update: {
    current: string;
    previous: string;
    type: FsItemType;
  }) => void;
  export type WithOnPathUpdate = { onPathUpdate: OnPathUpdate };

  type OnDelete = (item: TTreeItem) => void;
  export type WithOnDelete = { onDelete: OnDelete };

  type Dirname = () => string;

  const removeTrailingSlash = (path: string) => path.replace(/\/$/, "");
  const join = (parent: string, child: string) => `${parent}/${child}`;

  class Base<T extends FsItemType> implements TBase<T> {
    readonly type: T;
    name = $state("");
    focused = $state<boolean>();
    readonly delete: () => void;

    private readonly getPath: () => string;
    private readonly onPathUpdate: OnPathUpdate;

    get path(): string {
      return this.getPath();
    }

    constructor(
      type: T,
      name: string,
      dirname: Dirname,
      onPathUpdate: OnPathUpdate,
      _delete: TBase["delete"],
    ) {
      this.type = type;
      this.name = name;
      this.getPath = () => join(dirname(), this.name);
      this.onPathUpdate = onPathUpdate;
      this.delete = _delete;
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

  class Folder extends Base<"folder"> implements TFolder {
    children = $state<TTreeItem[]>([]);
    expanded = $state(false);

    constructor(
      name: string,
      dirname: Dirname,
      onPathUpdate: OnPathUpdate,
      _delete: TBase["delete"],
    ) {
      super("folder", name, dirname, onPathUpdate, _delete);
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
  }

  type LimitedFs = WithLimitFsReturn<
    "readdir",
    "isDirectory" | "name",
    { Await: true; Singular: true },
    { Promise: true; Array: true }
  >;

  const populate = async (
    fs: LimitedFs,
    parent: TFolder,
    onPathUpdate: OnPathUpdate,
    onDelete: OnDelete,
  ) => {
    const { path: _path, children } = parent;
    const path = () => removeTrailingSlash(_path);
    for (const entry of await fs.readdir(path(), { withFileTypes: true })) {
      const isDirectory = entry.isDirectory();
      let item: TTreeItem;
      const _delete = () =>
        onDelete(children.splice(children.indexOf(item), 1)[0]);
      if (isDirectory) {
        item = new Folder(entry.name, path, onPathUpdate, _delete);
        await populate(fs, item, onPathUpdate, onDelete);
      } else item = new Base("file", entry.name, path, onPathUpdate, _delete);
      children.push(item);
    }
  };

  type WithFs = { fs: Parameters<typeof populate>[0] };

  const splitPath = (path: string) => {
    while (path.startsWith("/")) path = path.slice(1);
    while (path.endsWith("/")) path = path.slice(0, -1);
    const parts = path.split("/");
    const name = parts.pop()!;
    return { dirname: parts.join("/"), name, parts };
  };
</script>

<script lang="ts">
  import FolderComponent from "./Folder.svelte";
  import FileComponent from "./File.svelte";
  import type { PanelProps } from "$lib/dockview-svelte/";
  import { onMount } from "svelte";

  type Props = WithFs & WithOnFileClick & WithOnPathUpdate & WithOnDelete;

  let { params }: PanelProps<"pane", Props> = $props();

  const { fs, onFileClick, onPathUpdate, onDelete } = params;

  const root = new Folder(
    "",
    () => "",
    () => {
      throw new Error("root should not be updated");
    },
    () => {
      throw new Error("root should not be deleted");
    },
  );

  populate(fs, root, onPathUpdate, onDelete);

  export const getRoot = () => root;

  export const find = (path: string): TTreeItem | undefined => {
    if (path === "/" || path === root.name) return root;
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

  export const add = (path: string, type: "file" | "folder") => {
    const { name, dirname } = splitPath(path);
    const parent = find(dirname);
    if (!parent || parent.type !== "folder")
      throw new Error("Parent not found");
    const { path: _path, children } = parent;
    const dirPath = () => removeTrailingSlash(_path);
    let item: TTreeItem;
    const _delete = () =>
      params.onDelete(children.splice(children.indexOf(item), 1)[0]);
    item =
      type === "file"
        ? new Base("file", name, dirPath, onPathUpdate, _delete)
        : new Folder(name, dirPath, onPathUpdate, _delete);
    parent.children.push(item);
    return item;
  };

  export const remove = (path: string, parent?: TFolder) => {
    const { name, dirname } = splitPath(path);
    parent ??= find(dirname) as TFolder;
    if (!parent || parent.type !== "folder") return false;
    const { children } = parent;
    const index = children.findIndex((child) => child.name === name);
    if (index === -1) return false;
    const deleted = children.splice(index, 1)[0];
    if (deleted.type === "file") return true;
    for (const child of deleted.children) remove(child.path, deleted);
    return true;
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

  let element: HTMLElement;

  onMount(() => {
    let parent = element.parentElement;
    while (parent && !parent?.classList.contains("dv-pane-body"))
      parent = parent.parentElement;
    parent?.classList.add("override-no-focus-outline");
  });

  $effect(() => {
    root.children.sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<div
  class="w-full h-full p-2 shadow-md z-50 focus:before:outline-none"
  bind:this={element}
>
  {#each root.children as child}
    {@const rename = child.rename.bind(child)}
    {#if child.type === "folder"}
      <FolderComponent
        {...child}
        {rename}
        {onFileClick}
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
