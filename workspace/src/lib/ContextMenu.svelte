<script lang="ts">
  import { type Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";

  type Props = {
    items: {
      content: Snippet;
      onclick: MouseEventHandler<HTMLButtonElement>;
    }[];
  };

  let { items }: Props = $props();
</script>

<div
  class="absolute z-20 top-full left-0 shadow-md rounded-lg bg-neutral-800 border border-neutral-700"
  role="menu"
  aria-orientation="vertical"
  aria-labelledby="hs-default"
>
  <ul class="p-1 space-y-0.5 border-b border-neutral-800" style:z-index="10000">
    {#each items as { onclick, content }}
      <li class="whitespace-nowrap">
        <button
          type="button"
          {onclick}
          class="w-full flex items-center gap-x-3 py-1.5 px-3 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:bg-neutral-700"
        >
          {@render content()}
        </button>
      </li>
    {/each}
  </ul>
</div>
