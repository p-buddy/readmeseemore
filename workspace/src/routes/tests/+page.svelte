<script lang="ts">
  import OperatingSystem from "$lib/OperatingSystem.js";
  import Tree from "$lib/file-tree/Tree.svelte";
  import { Sweater } from "sweater-vest";
  import { defer } from "$lib/utils/index.js";
</script>

<Sweater
  mode="serial"
  body={async ({ given, set, preventRender, expect }) => {
    const render = preventRender();

    const os = await OperatingSystem.Create({
      filesystem: {
        file: { file: { contents: "" } },
        dir: { directory: { file: { file: { contents: "" } } } },
      },
      force: true,
    });

    set({ os });

    render();

    const { tree } = await given("tree");
    const root = await tree.getRoot();

    expect(root).toBe(tree.find(""));
    const file = tree.find("file");
    expect(file?.type).toBe("file");
    const dir = tree.find("dir");
    expect(dir?.type).toBe("folder");
    const { children } = dir as typeof dir & { type: "folder" };
    expect(children[0].type).toBe("file");
    expect(children[0].name).toBe("file");
    expect(children[0].path).toBe("dir/file");
    expect(tree.find("dir/file")).toBe(children[0]);
    expect(root.children).toContain(file);
    expect(root.children).toContain(dir);

    const added = defer<boolean>();
    const filesToAdd = ["another", "dir/another"];
    const addedFiles: string[] = [];
    await os.watch((change) => {
      switch (change.action) {
        case "add":
          tree.add(change.path, "file");
          if (addedFiles.push(change.path) === filesToAdd.length)
            added.resolve(true);
          break;
      }
    });
    for (const file of filesToAdd) await os.container.fs.writeFile(file, "");
    await added.promise;
    expect(addedFiles).toEqual(filesToAdd);
    for (const file of addedFiles) expect(tree.find(file)).toBeDefined();
    console.log("done");
  }}
>
  {#snippet vest(pocket: { tree: Tree; os: OperatingSystem })}
    <Tree
      params={{
        fs: pocket.os.container.fs,
        onFileClick: () => {},
        onPathUpdate: () => {},
        onRemove: () => {},
        write: pocket.os.container.fs.writeFile,
      }}
      bind:this={pocket.tree}
    />
  {/snippet}
</Sweater>
