<script lang="ts">
  import OperatingSystem from "$lib/OperatingSystem.js";
  import Tree from "$lib/file-tree/Tree.svelte";
  import Vest from "./Vest.svelte";
  import type { FileSystemTree } from "@webcontainer/api";
  let {} = $props();

  type TestElements = {
    tree: Tree;
    os: OperatingSystem;
    filesystem?: FileSystemTree;
  };
</script>

<Vest
  body={async ({ given, set }) => {
    const filesystem = {
      "no-slash": { file: { contents: "" } },
      dir: { directory: { "no-slash": { file: { contents: "" } } } },
    };

    set({ filesystem });

    const { os, tree } = await given("os", "tree");
    const addedFiles: string[] = [];
    const removedFiles: string[] = [];
    await os.watch((change) => {
      switch (change.action) {
        case "add":
        case "addDir":
          addedFiles.push(change.path);
          break;
        case "unlink":
        case "unlinkDir":
          removedFiles.push(change.path);
          break;
      }
    });
    await os.container.fs.writeFile("./another", "hi");
    await os.container.fs.writeFile("./dir/another", "hi");
  }}
>
  {#snippet vest(pocket: TestElements)}
    {#await OperatingSystem.Create({ filesystem: pocket.filesystem }) then os}
      <Tree
        params={{
          fs: os.container.fs,
          onFileClick: () => {},
          onPathUpdate: () => {},
          onRemove: () => {},
        }}
        bind:this={pocket.tree}
      />
      {void (pocket.os = os)}
    {/await}
  {/snippet}
</Vest>
