<script lang="ts">
  import { page } from "$app/state";
  import Main from "$lib/Main.svelte";
  import { fromMarkdown } from "mdast-util-from-markdown";
  import { visit, type BuildVisitor } from "unist-util-visit";

  const { url } = $derived(page);

  type Params = {
    packages?: string[];
    target?: string;
    startup?: string;
  };

  const packages = $derived(url.searchParams.getAll("packages"));
  const target = $derived(url.searchParams.get("target"));
  const startup = $derived(url.searchParams.get("startup"));
</script>

{#if target}
  <div class="h-full w-full flex flex-col">
    <div class="w-full h-full m-0 overscroll-none flex-grow">
      <Main
        filesystem={{
          "index.ts": {
            file: {
              contents: "import { hi } from './hi';\nconst x = hi();",
            },
          },
          "hi.ts": {
            file: {
              contents: "export const hi = () => 4;",
            },
          },
          hi: {
            directory: {
              "hi.ts": {
                file: {
                  contents: "export const hi = () => 4;",
                },
              },
            },
          },
        }}
      />
    </div>
  </div>
{:else}
  <div class="h-full w-full flex flex-col">
    <div class="w-full h-full m-0 overscroll-none flex-grow">
      <div class="flex flex-col gap-4">
        <h1 class="text-2xl font-bold">Welcome to the Svelte Playground</h1>
      </div>
    </div>
  </div>
{/if}
