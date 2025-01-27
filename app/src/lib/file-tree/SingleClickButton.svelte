<script lang="ts" module>
  export type OnClick = EventHandler<MouseEvent, HTMLButtonElement>;
</script>

<script lang="ts">
  import { singleClickWrapper } from "$lib/utils";
  import type { Snippet } from "svelte";
  import type { EventHandler } from "svelte/elements";

  let { children, onclick }: { children: Snippet; onclick: OnClick } = $props();
</script>

<button onclick={singleClickWrapper(onclick)} class="font-medium">
  {@render children()}
</button>

<style>
  button {
    background-size: 1em 1em;
    border: none;
    font-size: 14px;
    display: flex;
    gap: 3px;
    align-items: center;
    outline: none;
    background: transparent no-repeat;
  }
</style>
