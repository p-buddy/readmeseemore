<script lang="ts" module>
  import { onContextMenu } from "$lib/context-menu/index.js";
  import { onDestroy, type Snippet } from "svelte";
  import Item from "./Item.svelte";

  type TextOrSnippet = string | Snippet;

  export type MenuItem = {
    content: TextOrSnippet;
  } & (
    | {
        shortcut?: string;
        onclick: () => void;
      }
    | {
        items: MenuItem[];
      }
  );

  export type MenuGroup = {
    group: TextOrSnippet;
  };

  export type MenuHeader = {
    content: TextOrSnippet;
    items: (MenuItem | MenuGroup)[];
  };
</script>

<script lang="ts">
  let { menus }: { menus: MenuHeader[] } = $props();

  let container: HTMLDivElement;
  let isOpen = $state(false);
  let index = $state(0);

  const tryHandleClickOutside = ({ target }: MouseEvent) => {
    if (target instanceof Node && !container.contains(target)) isOpen = false;
  };

  onDestroy(onContextMenu(tryHandleClickOutside));
</script>

<svelte:window onclick={tryHandleClickOutside} />

<div
  bind:this={container}
  class="w-full text-neutral-200 bg-neutral-700 select-none text-sm font-medium"
>
  <div class="flex items-center mx-1">
    {#each menus as menu, i}
      {@const open = isOpen && i === index}
      <button
        class="text-left relative flex flex-row items-center cursor-default hover:bg-neutral-500 px-3 first:pl-2 gap-2 py-0.5 rounded-sm *:hidden"
        class:open
        class:bg-neutral-500={open}
        onclick={() => {
          index = i;
          isOpen = !isOpen;
        }}
        onmouseenter={() => {
          if (!isOpen) return;
          index = i;
        }}
      >
        {#if typeof menu.content === "string"}
          {menu.content}
        {:else}
          {@render menu.content()}
        {/if}
        <div
          class="absolute top-full z-100 left-0 p-1 space-y-0.5 border-1 whitespace-nowrap rounded-sm border-neutral-600 bg-neutral-800"
        >
          {#each menu.items as item}
            {#if typeof item === "object" && "group" in item}
              <div class="text-xs text-neutral-400 px-2 py-1.5">
                {#if typeof item.group === "string"}
                  {item.group}
                {:else}
                  {@render item.group()}
                {/if}
              </div>
            {:else}
              <Item {item} />
            {/if}
          {/each}
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .open {
    @apply *:block;
  }
</style>
