import { type Options, type SourceCache, type SourceResolver, } from "monaco-editor-auto-typings";
import { ImportResolver } from "monaco-editor-auto-typings/lib/ImportResolver.js";
import { RecursionDepth } from "monaco-editor-auto-typings/lib/RecursionDepth.js";
import * as monaco from "@codingame/monaco-vscode-editor-api";
import { root } from "$lib/utils/webcontainer.js";
import type { WithLimitFs } from "$lib/utils/fs-helper.js";

const getDirectory = (path: string) => {
  const index = path.lastIndexOf("/");
  const directory = index >= 0 ? path.slice(0, index) : "";

  return directory.startsWith(root)
    ? directory
    : root + (directory.startsWith("/") ? directory.slice(1) : directory);
}

const getName = (path: string) => {
  const index = path.lastIndexOf("/");
  const name = index >= 0 ? path.slice(index + 1) : path;
  return name;
}

const prependRoot = (path: string) => {
  if (path.startsWith(root)) return path;
  return root + (path.startsWith("/") ? path.slice(1) : path);
}

const notImplemented = (name: string) => new Error(`Not implemented: ${name}`);

const withOnlyImplementedOptions = (options: Partial<Options>): Options => ({
  get sourceCache(): SourceCache { throw notImplemented("sourceCache"); },
  get sourceResolver(): SourceResolver { throw notImplemented("sourceResolver"); },
  get fileRootPath(): string { throw notImplemented("fileRootPath"); },
  get monaco(): typeof monaco { throw notImplemented("monaco"); },
  get shareCache(): boolean { throw notImplemented("shareCache"); },
  get onlySpecifiedPackages(): boolean { throw notImplemented("onlySpecifiedPackages"); },
  get preloadPackages(): boolean { throw notImplemented("preloadPackages"); },
  get dontAdaptEditorOptions(): boolean { throw notImplemented("dontAdaptEditorOptions"); },
  get dontRefreshModelValueAfterResolvement(): boolean { throw notImplemented("dontRefreshModelValueAfterResolvement"); },
  get debounceDuration(): number { throw notImplemented("debounceDuration"); },
  get packageRecursionDepth(): number { throw notImplemented("packageRecursionDepth"); },
  get fileRecursionDepth(): number { throw notImplemented("fileRecursionDepth"); },
  ...options,
})

let importResolver: ImportResolver | undefined;
let depth: RecursionDepth | undefined;

export const resolveImportsInFile = async (fs: WithLimitFs<"readFile" | "readdir">, path: string, content: string) => {
  importResolver ??= new ImportResolver(withOnlyImplementedOptions({
    fileRootPath: root,
    preloadPackages: false,
    onlySpecifiedPackages: false,
    monaco: new Proxy(monaco, {
      get(target, prop, receiver) {
        console.log("monaco", { prop });
        return Reflect.get(target, prop, receiver);
      },
    }),
    sourceCache: {
      storeFile: async (uri: string, content: string) => {
        console.log("storeFile", { uri, content });
      },
      getFile: async (uri: string) => {
        console.log("getFile", { uri });
        const target = prependRoot(uri);
        const parts = target.split("/");
        for (let i = 0; i <= parts.length - 1; i++) {
          const directory = parts.slice(0, i + 1).join("/");
          const name = parts[i + 1];
          const isLastDirectory = i === parts.length - 2;
          const files = await fs.readdir(directory, { withFileTypes: true });
          if (!files.some(file => file.name === name && file.isFile() === isLastDirectory))
            return undefined;
        }
        const content = await fs.readFile(target, "utf-8");
        return content;
      },
      clear: async () => {
        console.log("clear");
      },
    },
    sourceResolver: {
      resolvePackageJson: async (packageName, version, subPath) => {
        console.log("resolvePackageJson", { packageName, version, subPath });
        return undefined;
      },
      resolveSourceFile: async (packageName, version, path) => {
        console.log("resolveSourceFile", { packageName, version, path });
        return undefined;
      },
    },
    onError: (error) => {
      console.error("onError", { error });
    },
    onUpdate: (update, textual) => {
      console.log("onUpdate", { update, textual });
    },
    onUpdateVersions(versions) {
      console.log("onUpdateVersions", { versions });
    },
  }));

  depth ??= new RecursionDepth(withOnlyImplementedOptions({
    fileRecursionDepth: 10,
    packageRecursionDepth: 3,
  }));
  console.log("resolveImportsInFile", { content, path, depth, parent: getDirectory(path) });
  await importResolver.resolveImportsInFile(content, getDirectory(path), depth);
  if (importResolver.wereNewImportsResolved()) {
    console.log("new imports resolved");
  }
}

export const reset = () => {
  importResolver = undefined;
  depth = undefined;
}