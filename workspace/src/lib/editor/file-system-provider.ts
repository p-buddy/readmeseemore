import { Uri } from "@codingame/monaco-vscode-editor-api";
import type { FileSystemProviderCapabilities, FileType, FileChangeType, IFileChange, IFileSystemProviderWithFileReadWriteCapability, IStat } from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import { createFileSystemProviderError, FileSystemProviderErrorCode } from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import { dirname, exists, safelyGetFileContent, safelyStatFile, prependRoot, trySanitize } from "./utils.js";
import type OperatingSystem from "$lib/OperatingSystem.js";

export type FileSystemProvider = IFileSystemProviderWithFileReadWriteCapability;

const event = <Args extends any[] = []>() => {
  type Listener = (...args: Args) => any;
  const set = new Set<Listener>();

  const add = (listener: Listener) => {
    set.add(listener);
    return { dispose: () => set.delete(listener) }
  };

  const notify = (...args: Args) =>
    set.forEach(listener => listener(...args))

  return Object.assign(add, { notify });
}

const notImplemented = <T extends string>(name: T) => ({
  [name]: (...args: any[]) => {
    console.error("Not implemented", { name, args });
    throw createFileSystemProviderError(`Not implemented: ${name}`, FileSystemProviderErrorCode.Unavailable);
  }
} as Record<T, (...args: any[]) => never>);

export const createFileSystemProvider = (os: OperatingSystem): FileSystemProvider => {
  const { container: { fs } } = os;
  const onDidChangeCapabilities = event();
  const onDidChangeFile = event<[readonly IFileChange[]]>();
  const watching = new Set<string>();
  os.watch(({ path, action }) => {
    switch (action) {
      case "add":
      case "change":
      case "unlink":
        path = prependRoot(path);
        if (!watching.has(path)) return;
        const resource = Uri.parse(path);
        const type = action === "add"
          ? (1 satisfies FileChangeType.ADDED)
          : action === "change"
            ? (0 satisfies FileChangeType.UPDATED)
            : (2 satisfies FileChangeType.DELETED);
        if (action === "unlink") watching.delete(path);
        return onDidChangeFile.notify([{ type, resource }]);;
    }
  });
  return {
    capabilities: (2 satisfies FileSystemProviderCapabilities.FileReadWrite),
    onDidChangeCapabilities,
    onDidChangeFile,
    async readFile({ path }) {
      const content = await safelyGetFileContent(fs, path);
      if (content) return content;
      throw createFileSystemProviderError(
        `File not found: ${path}`,
        FileSystemProviderErrorCode.FileNotFound
      );
    },
    async writeFile({ path }, content, opts) {
      path = trySanitize(path);
      const doesExist = await exists(fs, path, true);
      if (doesExist)
        if (opts.overwrite)
          await fs.writeFile(path, content);
        else
          throw createFileSystemProviderError(
            `File already exists and overwrite is not requested: ${path}`,
            FileSystemProviderErrorCode.FileExists
          );
      else
        if (opts.create) {
          const directory = dirname(path);
          if (await exists(fs, directory, false))
            await fs.writeFile(path, content);
          else
            throw createFileSystemProviderError(
              `Directory does not exist: ${directory}`,
              FileSystemProviderErrorCode.FileNotADirectory
            );
        }
        else throw createFileSystemProviderError(
          `File does not exist and create is not requested: ${path}`,
          FileSystemProviderErrorCode.FileNotFound
        );
    },
    async stat(resource: Uri): Promise<IStat> {
      const { path } = resource;
      const type = await safelyStatFile(fs, path);
      if (!type) throw createFileSystemProviderError(
        `File not found: ${path}`,
        FileSystemProviderErrorCode.FileNotFound
      );
      const size = type === (1 satisfies FileType.File)
        ? (await this.readFile(resource)).length
        : 0;
      return {
        type,
        mtime: 0,
        ctime: 0,
        size,
      }
    },
    async readdir({ path }: Uri): Promise<[string, FileType][]> {
      const doesExist = await exists(fs, path, false);
      if (!doesExist) throw createFileSystemProviderError(
        `Directory not found: ${path}`,
        FileSystemProviderErrorCode.FileNotFound
      );
      const files = await fs.readdir(path, { withFileTypes: true });
      return files.map(file => [file.name, file.isFile() ? 1 satisfies FileType.File : 2 satisfies FileType.Directory]);
    },
    watch({ path }, opts) {
      watching.add(path);
      return { dispose: () => watching.delete(path) };
    },
    ...notImplemented("mkdir"),
    ...notImplemented("delete"),
    ...notImplemented("rename"),
  }
}
