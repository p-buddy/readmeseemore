export type Base<T extends "file" | "folder"> = {
  name: string;
  type: T;
};

export type File = Base<"file">;
export type Folder = Base<"folder"> & { files: (File | Folder)[], expanded?: boolean };
