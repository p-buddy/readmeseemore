<script lang="ts">
  import type { MenuItem } from "./Toolbar.svelte";
  import Item from "./Item.svelte";

  let { item, depth = 1 }: { item: MenuItem; depth?: number } = $props();

  let open = $state(false);
</script>

{#snippet right()}
  <span class="size-4">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g stroke-width="0"> </g>
      <g stroke-linecap="round" stroke-linejoin="round"> </g>
      <g>
        <path
          d="M9.71069 18.2929C10.1012 18.6834 10.7344 18.6834 11.1249 18.2929L16.0123 13.4006C16.7927 12.6195 16.7924 11.3537 16.0117 10.5729L11.1213 5.68254C10.7308 5.29202 10.0976 5.29202 9.70708 5.68254C9.31655 6.07307 9.31655 6.70623 9.70708 7.09676L13.8927 11.2824C14.2833 11.6729 14.2833 12.3061 13.8927 12.6966L9.71069 16.8787C9.32016 17.2692 9.32016 17.9023 9.71069 18.2929Z"
          fill="currentColor"
        >
        </path>
      </g>
    </svg>
  </span>
{/snippet}

<button
  class="w-full flex text-left items-center justify-between gap-x-3 py-1.5 px-3 rounded-sm text-sm text-neutral-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none transition-colors duration-100 hover:bg-neutral-600 relative"
  onmouseenter={() => {
    open = true;
  }}
  onmouseleave={() => {
    open = false;
  }}
  onclick={(e) => {
    if ("onclick" in item) item.onclick?.();
    else {
      e.stopPropagation();
    }
  }}
>
  <span class="flex-1">
    {#if typeof item.content === "string"}
      {item.content}
    {:else}
      {@render item.content()}
    {/if}
  </span>
  {#if "items" in item && (item.items?.length ?? 0) > 0}
    {@render right()}
    <div
      class="border-1 px-1 border-neutral-600 bg-neutral-800 rounded-sm absolute left-full invisible"
      style:top={"0"}
      style:left={"calc(100% - 0.5rem)"}
      class:visible={open}
      style:z-index={depth + 1000}
    >
      {#if open}
        {#each item.items as child}
          <Item item={child} depth={depth + 1} />
        {/each}
      {/if}
    </div>
  {/if}
  {#if "shortcut" in item && item.shortcut}
    <span class="text-neutral-400">{item.shortcut}</span>
  {/if}
</button>
