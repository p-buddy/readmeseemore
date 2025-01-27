<script lang="ts">
  import type { Props } from "$lib/utils/ui-framework";
  import Tree, { type TTreeItem } from "$lib/file-tree/Tree.svelte";
  import Editor from "$lib/Editor.svelte";

  // Create a sample filesystem structure
  const filesystem: TTreeItem[] = [
    {
      name: "src",
      type: "folder",
      path: "src",
      children: [
        {
          name: "main.ts",
          type: "file",
          path: "src/main.ts",
        },
        {
          name: "components",
          type: "folder",
          path: "src/components",
          children: [
            {
              name: "Button.svelte",
              type: "file",
              path: "src/components/Button.svelte",
            },
            {
              name: "Input.svelte",
              type: "file",
              path: "src/components/Input.svelte",
            },
          ],
        },
      ],
    },
    {
      name: "package.json",
      type: "file",
      path: "package.json",
    },
    {
      name: "README.md",
      type: "file",
      path: "README.md",
    },
  ];

  const findFolder = (items: TTreeItem[], searchPath: string): TTreeItem[] => {
    if (searchPath === "/") return items;

    const parts = searchPath.split("/").filter(Boolean);
    let current = items;

    for (const part of parts) {
      const folder = current.find(
        (item) => item.type === "folder" && item.name === part,
      ) as (TTreeItem & { children: TTreeItem[] }) | undefined;

      if (!folder) return [];
      current = folder.children;
    }

    return current;
  };

  const contentMap = new Map<string, string>();

  const params: Props<typeof Tree>["params"] &
    Pick<Props<typeof Editor>["params"], "fs"> = {
    fs: {
      readdir: async (path, options) => {
        return findFolder(filesystem, path || "/").map((item) => ({
          name: item.name,
          isDirectory: () => item.type === "folder",
        }));
      },
      readFile: (path, encoding) =>
        Promise.resolve(
          contentMap.has(path) ? contentMap.get(path)! : "",
        ) as any,
      writeFile: async (path, data) => {
        contentMap.set(path, data as string);
      },
    },
    onFileClick: () => {
      console.log("hi");
    },
    onPathUpdate: () => {
      console.log("hello");
    },
  };

  let tree: Tree;
</script>

{#snippet display(item: TTreeItem)}
  <div>
    <input bind:value={item.name} class="w-auto" />
    ({item.path})
  </div>
  {#if item.type === "folder"}
    {#each item.children as child}
      {@render display(child)}
    {/each}
  {/if}
{/snippet}

{#if tree}
  {#each tree.getRoot().children as child}
    {@render display(child)}
  {/each}
{/if}

<Tree {params} bind:this={tree} />

{#if tree}
  {#each tree.getRoot().children as child}
    <Editor params={{ ...params, path: child.path, name: child.name }} />
  {/each}
{/if}
