<script lang="ts" module>
  import { type WithGetContextItems } from "./FsContextMenu.svelte";
  import { type WithOnFile, type WithRename } from "./common.svelte.js";
  export type Props = WithOnFile & WithRename & WithGetContextItems;
</script>

<script lang="ts">
  import FolderComponent from "./Folder.svelte";
  import FileComponent from "./File.svelte";
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import { onMount } from "svelte";
  import type { OnlyRequire } from "$lib/utils/index.js";
  import FsContextMenu from "./FsContextMenu.svelte";
  import { slide } from "svelte/transition";
  import { focusColor, Root } from "./common.svelte.js";

  let { params }: OnlyRequire<PanelProps<"pane", Props>, "params"> = $props();

  const { getContextItems: getItems, ...rest } = params;

  export const root = new Root();

  let container = $state<HTMLElement>();

  export const getContainer = () => container;

  onMount(() => {
    let parent = container!.parentElement;
    while (parent && !parent?.classList.contains("dv-pane-body"))
      parent = parent.parentElement;
    parent?.classList.add("override-no-focus-outline");
  });

  $effect(() => {
    root.children.sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<FsContextMenu
  target={container}
  atCursor={true}
  getContextItems={getItems}
  type="root"
/>

<div
  class="w-full h-full flex flex-col z-50 p-2 shadow-md focus:before:outline-none"
  style:--focus-color={focusColor}
  bind:this={container}
>
  {#each root.children as child}
    <div transition:slide={{ duration: 300 }}>
      {#if child.type === "folder"}
        <FolderComponent {...rest} folder={child} getContextItems={getItems} />
      {:else}
        <FileComponent {...rest} file={child} getContextItems={getItems} />
      {/if}
    </div>
  {/each}
</div>

<style>
  :global(
      .override-no-focus-outline .override-no-focus-outline:focus:before,
      .override-no-focus-outline:focus-within:before
    ) {
    outline: none !important;
  }
</style>
