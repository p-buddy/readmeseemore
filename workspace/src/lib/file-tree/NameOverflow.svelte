<script lang="ts">
  import type { MouseEventHandler } from "svelte/elements";
  import { fade } from "svelte/transition";

  type EventHandlers = Record<
    "onmouseleave" | "onclick" | "ondblclick",
    MouseEventHandler<HTMLElement>
  >;

  let {
    name,
    background,
    onmouseleave,
    onclick,
    ondblclick,
  }: { name: string; background: string } & EventHandlers = $props();

  export const setBackground = (bg: string) => {
    background = bg;
  };
</script>

<button
  class="z-20001 text-nowrap cursor-default p-0 pr-1 rounded-md"
  style:background
  transition:fade={{ duration: 100 }}
  {onmouseleave}
  {onclick}
  {ondblclick}
>
  {name}
</button>
