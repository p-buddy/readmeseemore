import type { WithLimitFs } from "$lib/utils/fs-helper.js";
import { reset, resolveImportsInFile } from "./auto-typings.js";
import * as path from "path";
import { type Resolver, ResolverFactory } from "enhanced-resolve";
import { root } from "$lib/utils/webcontainer.js";
import { getResolver } from "./file-resolve/index.js";

let initializing: Promise<void> | undefined;
let initialized = false;

const onInitCallbacks = new Set<() => void>();

export const onInit = (callback: () => void) => {
  if (initialized) return callback();
  onInitCallbacks.add(callback);
}

export const initializeOnce = (initializer: () => typeof initializing) => {
  if (initializing) return initializing;
  initializing = initializer();
  initializing!.then(() => {
    for (const callback of onInitCallbacks) callback();
    onInitCallbacks.clear();
    initialized = true;
  });
  return initializing;
};

export const languageByExtension = {
  ts: "typescript",
  js: "javascript",
  svelte: "svelte",
} as const;

export type Extension = keyof typeof languageByExtension;
export type SupportedLanguage = typeof languageByExtension[Extension];

export const tryGetLanguageByFileExtension = (extension?: string) => {
  if (!extension || !(extension in languageByExtension)) return;
  return languageByExtension[extension as Extension];
};

export const tryGetLanguageByFile = (path?: string) => {
  if (!path) return;
  const index = path.lastIndexOf(".");
  if (index < 0) return;
  const extension = path.slice(index + 1);
  return tryGetLanguageByFileExtension(extension);
};

const fileRoot = "file:///";

const esmImportRegex = () => /\n*\s*import\s+(?:{[^{}]+}|.*?)\s*(?:from)?\s*['"](.*?)['"]|import\(.*?\)/g;

// can assume that any node_modules file, once scanned, does not need to be scanned again

const resolvedImports = new Map<string, Set<string>>();

const getDirectory = (path: string) => {
  const index = path.lastIndexOf("/");
  if (index < 0) return "";
  return path.slice(0, index);
}

const getPackageMap = async (path: string, fs: WithLimitFs<"readFile" | "readdir">) => {
  let search = path;
  let pkg: Partial<Record<"dependencies" | "devDependencies", Record<string, string>>> | undefined;
  let modulePaths: string | undefined;
  while (search !== "") {
    search = getDirectory(search);
    for (const file of await fs.readdir(search)) {
      if (file === "package.json")
        pkg = JSON.parse(await fs.readFile(search + "/package.json", "utf-8"));
      else if (file === "node_modules")
        modulePaths = search + "/node_modules";
    }
  }
  if (!pkg || !modulePaths) return;
  const modules = await fs.readdir(modulePaths, { withFileTypes: true });
  for (const module of modules) {
    const modulePath = modulePaths + "/" + module.name;
    const modulePkg = await getPackageMap(modulePath, fs);
  }
}

export const getImportedPaths = (fs: WithLimitFs<"readFile" | "readdir">, path: string, content: string): string[] | undefined => {
  const resolver = getResolver(fs);

  let regex: RegExp | undefined;
  switch (tryGetLanguageByFile(path)) {
    case "typescript":
    case "javascript":
    case "svelte":
      regex = esmImportRegex();
      break;
  }
  if (!regex) return;
  let paths: string[] | undefined;
  let match: RegExpExecArray | null;
  const index = path.lastIndexOf("/");
  const directory = (index >= 0 ? path.slice(0, index) : "") + "/";
  while ((match = regex.exec(content)) !== null) {
    const imported = match![1];
    resolver.resolve({} as any, directory, imported, {}, (err, result) => {
      console.log("resolve", { err, result });
    })
    if (imported.startsWith("./") || imported.startsWith("../")) {
      const { pathname } = new URL(imported, fileRoot + directory);
      (paths ??= []).push(pathname);
    }
    else {
      (paths ??= []).push(imported);
    }
  }
  return undefined;
  //console.log(paths);
  //return paths;
};