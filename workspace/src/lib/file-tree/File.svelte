<script lang="ts">
  import type { TFile, TSymlink } from "./Tree.svelte";
  import type { Props } from "$lib/utils/ui-framework.js";
  import EditableName from "./EditableName.svelte";
  import type { MouseEventHandler } from "svelte/elements";
  import FsContextMenu from "./FsContextMenu.svelte";
  import { onMount, untrack } from "svelte";

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4.5"
        >
          <g id="SVGRepo_bgCarrier" stroke-width="0" />
          <g
            id="SVGRepo_tracerCarrier"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <g id="SVGRepo_iconCarrier">
            <path
              fill-rule="evenodd"
              d="M3 3a2 2 0 012-2h9.982a2 2 0 011.414.586l4.018 4.018A2 2 0 0121 7.018V21a2 2 0 01-2 2H4.75a.75.75 0 010-1.5H19a.5.5 0 00.5-.5V8.5h-4a2 2 0 01-2-2v-4H5a.5.5 0 00-.5.5v6.25a.75.75 0 01-1.5 0V3zm12-.5v4a.5.5 0 00.5.5h4a.5.5 0 00-.146-.336l-4.018-4.018A.5.5 0 0015 2.5zm-5.692 12l-2.104-2.236a.75.75 0 111.092-1.028l3.294 3.5a.75.75 0 010 1.028l-3.294 3.5a.75.75 0 11-1.092-1.028L9.308 16H4.09a2.59 2.59 0 00-2.59 2.59v3.16a.75.75 0 01-1.5 0v-3.16a4.09 4.09 0 014.09-4.09h5.218z"
            />
          </g>
        </svg>
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="size-4.5"
        >
          <path
            d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
          />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
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
