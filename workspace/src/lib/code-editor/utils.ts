import type { WithLimitFs } from "$lib/utils/fs-helper.js";
import { root } from "$lib/utils/webcontainer.js";
import type { FileType } from "@codingame/monaco-vscode-api/vscode/vs/platform/files/common/files";
import type { DirEnt } from "@webcontainer/api";

export const removeLeading = (path: string, char: string) =>
  path.startsWith(char) ? path.slice(char.length) : path;

export const removeTrailing = (path: string, char: string) =>
  path.endsWith(char) ? path.slice(0, -char.length) : path;

export const trimChar = (path: string, char: string) =>
  removeLeading(removeTrailing(path, char), char);

export const trimSlash = (path: string) => trimChar(path, "/");

const sanitize = (path: string) => {
  if (path === root) return ".";
  if (path === removeTrailing(root, "/")) return ".";
  if (path === "/") return ".";
  if (path.startsWith(root)) return "./" + path.slice(root.length);
  if (path.startsWith("/")) return "./" + path.slice(1);
  if (!path.startsWith(".")) return "./" + path;
  return path;
}

const sanitized = (path: string) => path.startsWith(".");

export const trySanitize = (path: string) => sanitized(path) ? path : sanitize(path);

const preSanitize = <TReturn>(fn: (path: string) => TReturn) =>
  (path: string) => fn(trySanitize(path));

export const dirname = preSanitize(path => {
  path = removeTrailing(path, "/");
  const index = path.lastIndexOf("/");
  return index === -1 ? "." : path.slice(0, index) || ".";
})

export const parts = preSanitize(path => {
  path = removeTrailing(path, "/");
  const index = path.lastIndexOf("/");
  return index === -1
    ? { directory: ".", name: path }
    : { directory: path.slice(0, index) || ".", name: path.slice(index + 1) };
})

export const entry = async (fs: WithLimitFs<"readdir">, path: string, isFile?: boolean) => {
  path = trySanitize(path);
  if (isFile === false && path === ".") return undefined;
  const parts = path.split("/");
  let directory = "";
  let entry: DirEnt<string> | undefined;
  for (let i = 0; i < parts.length - 1; i++) {
    directory += parts[i] + "/";
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
    entry = files.find(file => file.name === name && (!requireType || file[requireType]()));
    if (!entry) return undefined;
  }
  return entry;
}

type Exists = (...args: Parameters<typeof entry>) => Promise<boolean>;

export const exists: Exists = async (fs, path, isFile) => {
  const _entry = await entry(fs, path, isFile);
  return !_entry ? (isFile === false && path === ".") : true;
}

export const isSymlink = (entry: DirEnt<string>) => !entry.isFile() && !entry.isDirectory();

type ReadableFs = WithLimitFs<"readdir" | "readFile">;
type Encoding = Parameters<WithLimitFs<"readFile">["readFile"]>[1];

let encoder: TextEncoder | undefined;

export function safelyGetFileContent(fs: ReadableFs, path: string): Promise<Uint8Array | null>;
export function safelyGetFileContent(fs: ReadableFs, path: string, encoding: Encoding): Promise<string | null>;
export async function safelyGetFileContent(fs: ReadableFs, path: string, encoding?: Encoding) {
  path = trySanitize(path);
  const _entry = await entry(fs, path, true);

  if (!_entry) {
    const maybeLink = await entry(fs, path);
    if (!maybeLink || !isSymlink(maybeLink)) return null;
    const result = await fs.readFile(path, "utf8");
    return encoding
      ? result
      : (encoder ??= new TextEncoder()).encode(result);
  }

  return encoding ? fs.readFile(path, encoding) : fs.readFile(path);
}

export const safelyStatFile = async (
  fs: WithLimitFs<"readdir">, path: string
): Promise<FileType | null> => {
  const { directory, name } = parts(path);
  const dirFound = await exists(fs, directory, false);
  if (!dirFound) return null;
  const files = await fs.readdir(directory, { withFileTypes: true });
  const file = files.find(file => file.name === name);

  return file
    ? file.isFile()
      ? 1 satisfies FileType.File
      : file.isDirectory()
        ? 2 satisfies FileType.Directory
        : 64 satisfies FileType.SymbolicLink
    : null;
};

export const prependRoot = (path: string) => {
  if (path.startsWith(root)) return path;
  if (path.startsWith("/")) return root + path.slice(1);
  if (path.startsWith("./")) return root + path.slice(2);
  return root + path;
}