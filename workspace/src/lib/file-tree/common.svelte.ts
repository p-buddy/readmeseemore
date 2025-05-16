import type { DirEnt } from "@webcontainer/api";
import type { WithLimitFsReturn } from "$lib/utils/fs.js";

export type LimitedFs = WithLimitFsReturn<
  "readdir",
  "isDirectory" | "name" | "isFile",
  { Await: true; Singular: true },
  { Promise: true; Array: true }
>;

export const focusColor = "rgba(255, 255, 255, 0.3)";

export type FsItemType = "file" | "folder" | "symlink";

export const entryType = (entry: DirEnt<unknown>): FsItemType =>
  entry.isDirectory() ? "folder" : entry.isFile() ? "file" : "symlink";

export type EditingState = {
  condition: boolean;
  override?: string;
  caretIndex?: number;
};

export type TBase<T extends FsItemType = FsItemType> = {
  name: string;
  get path(): string;
  readonly type: T;
  readonly editing: EditingState;
  readonly remove: () => void;
};

export type Focusable = { focused: boolean };

export type TFile = TBase<"file"> & Focusable;
export type TSymlink = TBase<"symlink"> & Focusable;

export type TFolder = TBase<"folder"> & {
  expanded: boolean;
  children: (TFile | TFolder | TSymlink)[];
  drop(item: TTreeItem): boolean;
};

export type TFileLike = TFile | TSymlink;
export type TTreeItem = TFile | TFolder | TSymlink;

export type Rename = (
  newName: string,
  item: Pick<TTreeItem, "path" | "name" | "type">,
) => void;

export type WithRename = { rename: Rename };

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
    const valid = index >= 0;
    if (valid) this.children.splice(index, 1);
    return valid;
  }
}

type Factory = {
  [k in FsItemType]: (
    options: BaseConfig<k>,
  ) => Extract<TTreeItem, { type: k }>;
};

export const factory = {
  file: (options: BaseConfig<"file">) => new File(options),
  symlink: (options: BaseConfig<"symlink">) => new Symlink(options),
  folder: (options: BaseConfig<"folder">) => new Folder(options),
} as const satisfies Factory;

export const basename = (path: string) => {
  const index = path.lastIndexOf("/");
  return index >= 0 ? path.slice(index + 1) : path;
};

export const iterate = (
  folder: TFolder,
  fn: (item: TTreeItem) => void,
  recurseBeforeExecution = false,
) => {
  for (const child of folder.children) {
    const isFolder = child.type === "folder";
    if (isFolder && recurseBeforeExecution) iterate(child, fn);
    fn(child);
    if (isFolder && !recurseBeforeExecution) iterate(child, fn);
  }
};

const populate = async (fs: LimitedFs, parent: TFolder) => {
  const dirname = () => parent.path;
  const entries = await fs.readdir(parent.path, { withFileTypes: true });
  for (const entry of entries) {
    const remove = () => parent.drop(item);
    const item = factory[entryType(entry)]({ ...entry, dirname, remove });
    if (item.type === "folder") await populate(fs, item);
    parent.children.push(item);
  }
};

export class Root extends Folder implements TFolder {
  focused?: Extract<TTreeItem, Focusable>;

  constructor() {
    super({
      name: "",
      dirname: () => "",
      remove: () => {
        throw new Error("root should not be removed");
      },
    });
  }

  findParent(path: string, ancestors?: TFolder[]): TFolder | undefined {
    if (path === this.name) throw new Error("Root has no parent");

    let searchFolder: TFolder = this;
    const index = path.lastIndexOf("/");

    ancestors?.push(searchFolder);

    if (index === -1) return searchFolder;

    const parts = path.slice(0, index).split("/");
    let partIndex = 0;
    while (partIndex < parts.length) {
      const target = parts[partIndex];
      let found = false;
      for (const child of searchFolder.children)
        if (child.type === "folder" && child.name === target) {
          searchFolder = child;
          ancestors?.push(searchFolder);
          partIndex++;
          found = true;
          break;
        }
      if (!found) return undefined;
    }

    return searchFolder;
  };

  find(path: string, parent?: TFolder): TTreeItem | undefined {
    if (path === this.name) return this;
    parent ??= this.findParent(path);
    if (!parent) throw new Error("Parent not found");
    const name = basename(path);
    return parent.children.find((child) => child.name === name);
  };

  touch(path: string, type: FsItemType) {
    const parent = this.findParent(path);
    if (!parent || parent.type !== "folder")
      throw new Error("Parent not found");
    const item = factory[type]({
      name: basename(path),
      dirname: () => parent.path,
      remove: () => parent.drop(item),
    });
    parent.children.push(item);
    return item;
  };

  rm(path: string, parent?: TFolder) {
    parent ??= this.findParent(path);
    if (!parent) return false;
    const entry = this.find(path, parent);
    if (!entry) return false;
    const result = parent.drop(entry);
    if (result && entry.type === "folder")
      for (const child of entry.children) this.rm(child.path, entry);
    return result;
  };

  tryFocus(path?: string) {
    if (this.focused) this.focused.focused = false;
    if (!path) return;
    const item = this.find(path);
    if (!item || item.type === "folder") return;
    item.focused = true;
    this.focused = item;
  }

  populate(fs: LimitedFs) {
    return populate(fs, this);
  }
}

export type WithFs = { fs: Parameters<typeof populate>[0] };