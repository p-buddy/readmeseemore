<script lang="ts">
  import OperatingSystem from "$lib/OperatingSystem.js";
  import Tree from "$lib/file-tree/Tree.svelte";
  import { type FileSystemTree } from "@webcontainer/api";
  import { run, current } from "./vest.js";

  let {} = $props();

  type TestElements = {
    tree: Tree;
    os: OperatingSystem;
    container: HTMLDivElement;
    filesystem?: FileSystemTree;
  };
</script>

{#await run<TestElements>(async ({ given, set, v }) => {
  const filesystem = { "no-slash": { file: { contents: "" } }, dir: { directory: { "no-slash": { file: { contents: "" } } } } };
  set({ filesystem });
  const { os, tree, container } = await given("os", "tree", "container");
  await os.watch((change) => {
    console.log(change);
  });
  await os.container.fs.writeFile("no-slash", "hi", { encoding: "utf-8" });
  v.expect(() => {}).toThrowError();
})}
  {@const test = current<TestElements>()}
  <div class="h-screen w-screen" bind:this={test.container}>
    {#await OperatingSystem.Create({ filesystem: test.filesystem }) then os}
      {test.set({ os })}
      <Tree
        params={{
          fs: os.container.fs,
          onFileClick: () => {},
          onPathUpdate: () => {},
          onRemove: () => {},
        }}
        bind:this={test.tree}
      />
    {/await}
  </div>
{:catch x}
  <div>
    <h1>Test Case</h1>
  </div>
{/await}
