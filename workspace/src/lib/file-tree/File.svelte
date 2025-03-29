<script lang="ts" module>
  let toFocus: string | undefined;
  export const focusOnMount = (path: string) => (toFocus = path);
</script>

<script lang="ts">
  import type { TFile } from "./Tree.svelte";
  import type { Props } from "$lib/utils/ui-framework.js";
  import EditableName from "./EditableName.svelte";
  import type { MouseEventHandler } from "svelte/elements";
  import FsContextMenu from "./FsContextMenu.svelte";
  import { onMount } from "svelte";

  type OnClick = MouseEventHandler<HTMLButtonElement>;

  let {
    name = $bindable(),
    path,
    focused,
    rename,
    onclick,
    remove,
  }: { onclick: OnClick } & TFile & Props<typeof EditableName> = $props();

  let nameUI = $state<EditableName>();
  let topLevel = $state<HTMLElement>();

  onMount(() => {
    if (toFocus !== path) return;
    nameUI?.highlight();
    nameUI?.edit(true, name.length);
  });
</script>

<FsContextMenu {nameUI} open={onclick} {remove} target={topLevel} {name} />

<button
  {onclick}
  class="relative flex w-full rounded-sm"
  class:focused
  bind:this={topLevel}
>
  <span class="w-full flex flex-row items-center gap-0.5">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="size-4.5"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
    <EditableName bind:name {rename} bind:this={nameUI} />
  </span>
</button>

<style>
  .focused {
    background-color: rgba(255, 255, 255, 0.3);
  }
</style>
