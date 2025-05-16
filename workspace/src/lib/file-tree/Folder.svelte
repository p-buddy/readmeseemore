<script lang="ts">
  import type { TFolder, WithOnFile, WithRename } from "./common.svelte.js";
  import File from "./File.svelte";
  import Self from "./Folder.svelte";
  import { fade } from "svelte/transition";
  import { folderExpanded, folderCollapsed } from "./Icons.svelte";
  import EditableName, { nameEdit } from "./EditableName.svelte";
  import FsContextMenu, { type WithGetItems } from "./FsContextMenu.svelte";
  import FolderSlideTransition from "./folder-slide-transition.js";

  type WithMinimalFolder = {
    folder: Pick<
      TFolder,
      "name" | "path" | "type" | "children" | "expanded" | "editing"
    >;
  };

  let {
    folder,
    rename,
    getItems,
    ...rest
  }: WithMinimalFolder & WithGetItems & WithOnFile & WithRename = $props();

  let topLevel = $state<HTMLElement>();
  let nameUI = $state<EditableName>();

  $effect(() => {
    folder.children.sort((a, b) => a.name.localeCompare(b.name));
  });

  let childContainer: HTMLElement;
  const folderSlider = new FolderSlideTransition();

  $effect(() => {
    const isOpening = folder.expanded;
    if (childContainer) folderSlider.fire(isOpening, childContainer);
  });
</script>

<FsContextMenu
  {nameUI}
  {getItems}
  item={folder}
  type="folder"
  target={topLevel}
  beforeAction={() => nameEdit.exit(folder)}
/>

<button
  onclick={() => (folder.expanded = !folder.expanded)}
  class="relative flex w-full"
  bind:this={topLevel}
>
  <span class="w-full flex items-center gap-0.5">
    <div class="shrink-0">
      {#if folder.expanded}
        {@render folderExpanded()}
      {:else}
        {@render folderCollapsed()}
      {/if}
    </div>
    <EditableName item={folder} {rename} bind:this={nameUI} />
  </span>
</button>

<div bind:this={childContainer}>
  {#if folder.expanded && folder.children.length > 0}
    <ul out:fade={{ duration: FolderSlideTransition.DurationMs + 100 }}>
      {#each folder.children as child}
        <li>
          {#if child.type === "folder"}
            <Self {...rest} folder={child} {getItems} {rename} />
          {:else}
            <File {...rest} file={child} {getItems} {rename} />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  ul {
    padding: 0.2em 0 0 0.5em;
    margin: 0 0 0 0.5em;
    list-style: none;
    border-left: 2px solid #555353;
  }

  li {
    padding: 0.2em 1px;
  }
</style>
