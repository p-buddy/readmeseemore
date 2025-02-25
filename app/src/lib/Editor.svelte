<script lang="ts" module>
  import { type WithLimitFs } from "./utils/fs-helper";
  import type * as monaco from "monaco-editor";
  import {
    AutoTypings,
    LocalStorageCache,
    UnpkgSourceResolver,
    type SourceResolver,
    type SourceCache,
  } from "monaco-editor-auto-typings/custom-editor";

  export type Editor = monaco.editor.IStandaloneCodeEditor;
  export type Monaco = typeof monaco;

  let sourceCache: SourceCache | undefined;
  let sourceResolver: SourceResolver | undefined;

  class LocalFirstSourceResolver implements SourceResolver {
    private readonly fs: WithLimitFs<"readFile">;
    private readonly unpkgResolver: UnpkgSourceResolver;

    constructor(fs: WithLimitFs<"readFile">) {
      this.fs = fs;
      this.unpkgResolver = new UnpkgSourceResolver();
    }

    async resolvePackageJson(
      packageName: string,
      version?: string,
      subPath?: string,
    ) {
      const { PackageJsonPath } = LocalFirstSourceResolver;
      return this.fs
        .readFile(PackageJsonPath(packageName, subPath), "utf-8")
        .catch(() =>
          this.unpkgResolver.resolvePackageJson(packageName, version, subPath),
        );
    }

    async resolveSourceFile(
      packageName: string,
      version: string | undefined,
      path: string,
    ): Promise<string | undefined> {
      const { SourcePath } = LocalFirstSourceResolver;
      return this.fs
        .readFile(SourcePath(packageName, path), "utf-8")
        .catch(() =>
          this.unpkgResolver.resolveSourceFile(packageName, version, path),
        );
    }

    private static PackageJsonPath = (packageName: string, subPath?: string) =>
      `node_modules/${packageName}${subPath ? `/${subPath}` : ""}/package.json`;

    private static SourcePath = (packageName: string, path: string) =>
      `node_modules/${packageName}/${path}`;
  }

  const sanitize = (path: string) => {
    while (path.startsWith("/")) path = path.slice(1);
    return path;
  };

  const matches = ({ uri }: monaco.editor.ITextModel, path: string) =>
    sanitize(uri.path) === sanitize(path);

  const languageByExtension = {
    ts: "typescript",
    js: "javascript",
  };

  type Extension = keyof typeof languageByExtension;

  let createModelsInProgress: Promise<any> | undefined;

  const createAllCodeModels = async (
    monaco: Monaco,
    fs: WithLimitFs<"readdir" | "readFile">,
    options?: Partial<{
      directory: string;
      extensions: Extension[];
      models: Set<string>;
    }>,
  ) => {
    if (createModelsInProgress) await createModelsInProgress;
    const { editor, Uri } = monaco;
    options ??= {};
    options.directory ??= "/";
    options.extensions ??= ["ts", "js"];
    options.models ??= new Set(
      editor.getModels().map(({ uri: { path } }) => sanitize(path)),
    );
    const { models, extensions, directory } = options;
    createModelsInProgress = new Promise<void>(async (resolve) => {
      const entries = await fs.readdir(directory, {
        withFileTypes: true,
      });
      await Promise.all(
        entries
          .map(async (entry) => {
            const path = `${directory}/${entry.name}`;
            const extension = entry.name.split(".").pop() as Extension;
            return entry.isDirectory()
              ? createAllCodeModels(monaco, fs, {
                  directory: sanitize(path),
                  extensions,
                  models,
                })
              : extensions.includes(extension) && !models.has(sanitize(path))
                ? fs
                    .readFile(path, "utf-8")
                    .then((content) =>
                      editor.createModel(
                        content,
                        languageByExtension[extension],
                        Uri.parse(`file:///${sanitize(path)}`),
                      ),
                    )
                    .then(() => models.add(sanitize(path)))
                : null;
          })
          .filter(Boolean),
      );
      resolve();
    });
  };
</script>

<script lang="ts">
  import type { PanelProps } from "./dockview-svelte";
  import Monaco from "@monaco-editor/react";
  import type { CollabInstance } from "./collaboration";
  import { sveltify } from "@p-buddy/svelte-preprocess-react";
  import { isDark } from "./mode";
  import type { TFile } from "./file-tree/Tree.svelte";
  import { onDestroy, type Snippet } from "svelte";
  import { retry } from "./utils";
  import type { MouseEventHandler } from "svelte/elements";

  type Props = {
    fs: WithLimitFs<"readFile" | "writeFile" | "readdir">;
    sync?: CollabInstance;
  } & { file: Pick<TFile, "name" | "path"> };

  let { params, api }: PanelProps<"dock", Props> = $props();

  const { fs, sync } = params;

  const react = sveltify({ Monaco });

  sourceCache ??= new LocalStorageCache();
  sourceResolver ??= new LocalFirstSourceResolver(fs);

  let editor = $state<Editor>();
  let typings: AutoTypings;

  $effect(() => {
    const { name } = params.file;
    api?.setTitle(name);
  });

  $effect(() => {
    if (!editor) return;
    retry(async () => {
      const contents = await fs.readFile(params.file.path, "utf-8");
      editor?.setValue(contents);
    });
  });

  onDestroy(() => {
    typings?.dispose();
    editor?.dispose();
  });

  const path = $derived.by(() => {
    const { path } = params.file;
    const model = editor?.getModel();
    if (model && !matches(model, path)) model.dispose();
    return path;
  });
</script>

<div class="hidden">
  {#snippet button(
    content: Snippet,
    onclick: MouseEventHandler<HTMLButtonElement>,
  )}
    <button
      type="button"
      {onclick}
      class="px-3 py-2 text-xs font-medium text-center inline-flex items-center rounded-lg text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
    >
      {@render content()}
    </button>
  {/snippet}
  {#snippet clearCache()}
    Clear Source Cache
  {/snippet}
  {@render button(clearCache, () => sourceCache?.clear())}
</div>

<react.Monaco
  {path}
  theme={isDark.current ? "vs-dark" : "vs-light"}
  keepCurrentModel={false}
  options={{ padding: { top: 10 } }}
  onChange={(value) => fs.writeFile(params.file.path, value || "", "utf-8")}
  onMount={(_editor, monaco) => {
    editor = _editor;
    AutoTypings.create(editor, {
      monaco,
      sourceCache,
      sourceResolver,
      fileRootPath: "file:///",
    }).then((t) => (typings = t));

    sync?.syncEditor(editor);

    createAllCodeModels(monaco, fs);
  }}
/>
