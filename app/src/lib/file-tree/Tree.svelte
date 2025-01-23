<script lang="ts">
  import type { Folder as TFolder } from ".";
  import Folder from "./Folder.svelte";

  let folders = [
    {
      type: "folder",
      name: "lib",
      files: [{ type: "file", name: "index.ts" }],
      expanded: true,
    },
    {
      type: "folder",
      name: "routes",
      files: [
        {
          type: "folder",
          name: "magic",
          files: [
            { type: "file", name: "page.svelte" },
            { type: "file", name: "code.png" },
          ],
        },
        {
          type: "folder",
          name: "luxe",
          files: [
            { type: "file", name: "page.svelte" },
            { type: "file", name: "layout.svelte" },
          ],
        },
        { type: "file", name: "page.svelte" },
        { type: "file", name: "layout.svelte" },
        { type: "file", name: "page.server.ts" },
      ],
    },
  ] satisfies TFolder[];
</script>

<div class="min-h-64 min-w-80 p-6 rounded-xl border bg-black shadow-md z-50">
  {#each folders as folder}
    <Folder {...folder} />
  {/each}
</div>
