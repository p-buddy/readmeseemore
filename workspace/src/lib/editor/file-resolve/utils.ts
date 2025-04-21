import type { WithLimitFs } from "$lib/utils/fs-helper.js";
import { root } from "$lib/utils/webcontainer.js";
import { type FileSystem } from "enhanced-resolve";

export const removeLeading = (path: string, char: string) =>
  path.startsWith(char) ? path.slice(char.length) : path;

export const removeTrailing = (path: string, char: string) =>
  path.endsWith(char) ? path.slice(0, -char.length) : path;

export const trimChar = (path: string, char: string) =>
  removeLeading(removeTrailing(path, char), char);

export const trimSlash = (path: string) => trimChar(path, "/");

export const prependRoot = (path: string) => {
  if (path.startsWith(root)) return path;
  return root + (path.startsWith("/") ? path.slice(1) : path);
}

export const dirname = (path: string) => {
  path = removeTrailing(path, "/");
  const index = path.lastIndexOf("/");
  return index === -1 ? "" : path.slice(0, index);
}

export const parts = (path: string) => {
  path = removeTrailing(path, "/");
  const index = path.lastIndexOf("/");
  return index === -1
    ? { directory: "", name: path }
    : { directory: path.slice(0, index), name: path.slice(index + 1) };
}

export const exists = async (fs: WithLimitFs<"readdir">, path: string, isFile?: boolean) => {
  const parts = removeTrailing(path, "/").split("/");
  if (parts.length === 1) parts.unshift("");
  for (let i = 0; i < parts.length - 1; i++) {
    const directory = parts.slice(0, i + 1).join("/");
    const name = parts[i + 1];
    const isLastDirectory = i === parts.length - 2;
    const files = await fs.readdir(directory, { withFileTypes: true });
    type EntryKey = keyof typeof files[number];
    const requireType: EntryKey | undefined =
      isLastDirectory
        ? isFile !== undefined
          ? isFile
            ? "isFile"
            : "isDirectory"
          : undefined
        : "isDirectory";
    if (!files.some(file =>
      file.name === name && (!requireType || file[requireType]())))
      return false;
  }
  return true;
}

type Stat = Exclude<Parameters<Parameters<FileSystem["stat"]>[2]>[1], undefined>;

type ReadableFs = WithLimitFs<"readdir" | "readFile">;

type Encoding = Parameters<WithLimitFs<"readFile">["readFile"]>[1];

export function safelyGetFileContent(fs: ReadableFs, path: string): Promise<Uint8Array | null>;
export function safelyGetFileContent(fs: ReadableFs, path: string, encoding: Encoding): Promise<string | null>;
export async function safelyGetFileContent(fs: ReadableFs, path: string, encoding?: Encoding) {
  const found = await exists(fs, path, true);
  if (!found) return null;
  return encoding ? fs.readFile(path, encoding) : fs.readFile(path);
}

export const safelyStatFile = async (fs: WithLimitFs<"readdir">, path: string) => {
  const { directory, name } = parts(path);
  const dirFound = exists(fs, directory, false);
  if (!dirFound) return null;
  const files = await fs.readdir(directory, { withFileTypes: true });
  const file = files.find(file => file.name === name);
  if (!file) return null;
  return new Proxy({} as Stat, {
    get: (_, prop: any) => {
      switch (prop) {
        case "isFile": return () => {
          console.error("isFile", { file });
          return file.isFile();
        };
        case "isDirectory": return () => {
          console.error("isDirectory", { file });
          return file.isDirectory();
        };
        case "isSymbolicLink": return () => {
          console.error("isSymbolicLink", { file });
          return false;
        };
        default: {
          console.error("stat", { path, prop });
          throw new Error(`Unknown property: ${prop}`);
        }
      }
    }
  });
}
