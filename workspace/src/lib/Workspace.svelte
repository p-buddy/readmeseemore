<script lang="ts">
  import { type FileSystemTree, type BufferEncoding } from "@webcontainer/api";
  import { iterateFilesystem } from "./utils/fs-helper.js";
  import {
    Grid,
    Toolbar,
    type GridProps,
    type Elements,
    type OS,
  } from "./main/index.js";

  let {
    filesystem,
    status,
    onReady,
  }: Pick<GridProps, "filesystem" | "status" | "onReady"> = $props();

  let os = $state<OS>();
  let elements = $state<Elements>();

  const onSave: GridProps["onSave"] = ({ path }) => {
    if (path.endsWith(".ts")) {
      const command = `npx --yes tsx ${path}`;
      os!.terminal.enqueueCommand(command);
    }
  };

  const sanitize = (path: string) => {
    while (path.startsWith("/")) path = path.slice(1);
    return path;
  };

  export const writeFile = (path: string, content = "") =>
    os!.container.fs.writeFile(sanitize(path), content);

  export const readFile = (path: string, encoding: BufferEncoding = "utf-8") =>
    os!.container.fs.readFile(sanitize(path), encoding);

  export const updateFilesystem = async (
    filesystem: FileSystemTree,
    path = "",
  ) => iterateFilesystem(filesystem, writeFile, path);

  export const system = <TRequire extends boolean = true>(
    require = true as TRequire,
  ): TRequire extends true ? typeof os : typeof os | undefined => {
    if (!os && require) throw new Error("Operating system not initialized");
    return os!;
  };
</script>

<section class="w-full h-full flex flex-col">
  <div class="w-full">
    <Toolbar {elements} {os} />
  </div>
  <div class="w-full flex-1 overflow-hidden">
    <Grid {filesystem} {status} {onReady} {onSave} bind:os bind:elements />
  </div>
</section>

<style>
  section {
    font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
    line-height: 1.5;
    font-weight: 400;

    color-scheme: dark;
    background-color: #181818;

    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-text-size-adjust: 100%;
  }
</style>
