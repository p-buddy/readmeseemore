<script lang="ts">
  import type { TFile, TSymlink } from "./Tree.svelte";
  import type { Props } from "$lib/utils/svelte.js";
  import EditableName from "./EditableName.svelte";
  import type { MouseEventHandler } from "svelte/elements";
  import FsContextMenu from "./FsContextMenu.svelte";
  import { onMount, untrack } from "svelte";
  import { file, symlink } from "./icons.svelte";

  type OnClick = MouseEventHandler<HTMLButtonElement>;

  let {
    name = $bindable(),
    type,
    focused,
    rename,
    onclick,
    remove,
    editing,
  }: { onclick: OnClick; editing: boolean } & (TFile | TSymlink) &
    Props<typeof EditableName> = $props();

  let nameUI = $state<EditableName>();
  let topLevel = $state<HTMLElement>();

  $effect(() => {
    if (!editing) return;
    untrack(() => {
      nameUI?.highlight();
      nameUI?.edit(true, 0, "");
    });
  });
</script>

<FsContextMenu
  {nameUI}
  open={onclick}
  {remove}
  target={topLevel}
  {name}
  beforeAction={() => nameUI?.edit(false, name)}
/>

<button
  {onclick}
  class="relative flex w-full rounded-sm"
  class:focused
  bind:this={topLevel}
>
  <span class="w-full flex flex-row items-center gap-0.5">
    <div class="shrink-0">
      {#if type === "symlink"}
        {@render symlink()}
      {:else}
        {@render file()}
      {/if}
    </div>
    <EditableName bind:name {rename} bind:this={nameUI} />
  </span>
</button>

<style>
  .focused {
    background-color: rgba(255, 255, 255, 0.3);
  }

  svg {
    will-change: transform, opacity;
    backface-visibility: hidden;
  }
</style>
