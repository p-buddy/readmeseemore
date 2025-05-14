<script lang="ts" module>
  import { onMount, type Snippet } from "svelte";
  import type { MouseEventHandler } from "svelte/elements";

  type OnHover = {
    onmouseenter: MouseEventHandler<HTMLButtonElement>;
    onmouseleave: MouseEventHandler<HTMLButtonElement>;
  };

  export type Props = {
    items: {
      content: Snippet;
      onclick: MouseEventHandler<HTMLButtonElement>;
      onhover?: () => OnHover;
    }[];
    close: () => void;
  };

  const noop = () => {};

  const defaultOnHover = {
    onmouseenter: noop,
    onmouseleave: noop,
  } satisfies OnHover;
</script>

<script lang="ts">
  let { items, close }: Props = $props();

  let visible = $state(false);

  let element: HTMLElement;

  onMount(() => {
    const { top, height } = element.getBoundingClientRect();
    const { innerHeight } = window;
    if (top + height > innerHeight)
      element.style.top = `${innerHeight - top - height}px`;
    visible = true;
  });
</script>

<svelte:window onclick={close} />

<div
  class="absolute overflow-visible visible clear-both z-10000 top-full left-0 shadow-md rounded-lg bg-neutral-800 border border-neutral-700 transition-opacity opacity-0 duration-50"
  class:opacity-100={visible}
  role="menu"
  aria-orientation="vertical"
  aria-labelledby="hs-default"
  bind:this={element}
>
  <ul class="p-1 space-y-0.5 border-b border-neutral-800">
    {#each items as { onclick, content, onhover }}
      {@const { onmouseenter, onmouseleave } = onhover?.() ?? defaultOnHover}
      <li class="whitespace-nowrap">
        <button
          type="button"
          {onclick}
          {onmouseenter}
          {onmouseleave}
          class="w-full flex items-center gap-x-3 py-1.5 px-3 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:bg-neutral-700"
        >
          {@render content()}
        </button>
      </li>
    {/each}
  </ul>
</div>
