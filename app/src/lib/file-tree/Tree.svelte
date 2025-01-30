<script lang="ts" module>
  import type { WithLimitFsReturn } from "$lib/utils/fs-helper";

  type FsItemType = "file" | "folder";

  type ForceRename = { dirnameOverride: string };

  export type TBase<T extends FsItemType = FsItemType> = {
    name: string;
    type: T;
    get path(): string;
    rename: (update: string, force?: ForceRename) => boolean;
  };

  export type TFile = TBase<"file">;
  export type TFolder = TBase<"folder"> & {
    children: (TFile | TFolder)[];
    expanded?: boolean;
  };
  export type TTreeItem = TFile | TFolder;

  export type WithOnFileClick = { onFileClick: (file: TFile) => void };

  type OnPathUpdate = (update: { current: string; previous: string }) => void;
  export type WithOnPathUpdate = { onPathUpdate: OnPathUpdate };

  type Dirname = () => string;

  const removeTrailingSlash = (path: string) => path.replace(/\/$/, "");
  const join = (parent: string, child: string) => `${parent}/${child}`;

  class Base<T extends FsItemType> implements TBase<T> {
    readonly type: T;
    name = $state("");
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
    ) {
      this.type = type;
      this.name = name;
      this.getPath = () => join(dirname(), this.name);
      this.onPathUpdate = onPathUpdate;
    }

    rename(update: string, force?: ForceRename) {
      let previousPath = this.path;
      const renamed = update !== this.name;
      if (renamed) this.name = update;
      if (force?.dirnameOverride)
        previousPath = join(force?.dirnameOverride, this.name);

      if (renamed || force?.dirnameOverride)
        this.onPathUpdate?.({ current: this.path, previous: previousPath });

      return renamed;
    }
  }

  class Folder extends Base<"folder"> implements TFolder {
    children = $state<TTreeItem[]>([]);
    expanded = $state(false);

    constructor(name: string, dirname: Dirname, onPathUpdate: OnPathUpdate) {
      super("folder", name, dirname, onPathUpdate);
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
  ) => {
    const path = () => removeTrailingSlash(parent.path);
    for (const entry of await fs.readdir(path(), { withFileTypes: true })) {
      const isDirectory = entry.isDirectory();
      let item: TTreeItem;
      if (isDirectory) {
        item = new Folder(entry.name, path, onPathUpdate);
        await populate(fs, item, onPathUpdate);
      } else item = new Base("file", entry.name, path, onPathUpdate);
      parent?.children.push(item);
    }
  };

  type WithFs = { fs: Parameters<typeof populate>[0] };
</script>

<script lang="ts">
  import FolderComponent from "./Folder.svelte";
  import FileComponent from "./File.svelte";

  import type { PanelPropsByView } from "$lib/dockview-svelte";

  type Props = WithFs & WithOnFileClick & WithOnPathUpdate;

  let { params }: PanelPropsByView<Props>["pane"] = $props();

  const { fs, onFileClick, onPathUpdate } = params;

  const root = new Folder(
    "",
    () => "",
    () => {
      throw new Error("root should not be updated");
    },
  );
  populate(fs, root, onPathUpdate);

  export const getRoot = () => root;

  export const insertFile = (path: string) => {
    const parts = path.split("/");
    const name = parts.pop()!;
    let searchFolder: TFolder = root;
    let partIndex = 0;
    while (partIndex < parts.length)
      for (const child of root.children)
        if (child.type === "folder" && child.name === parts[partIndex]) {
          searchFolder = child;
          partIndex++;
          break;
        }

    searchFolder.children.push(
      new Base("file", name, () => searchFolder.path, onPathUpdate),
    );
  };
</script>

<div class="min-h-64 min-w-80 p-6 rounded-xl border bg-black shadow-md z-50">
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
$
