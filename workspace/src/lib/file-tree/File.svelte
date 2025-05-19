<script lang="ts">
  import type { TFileLike, WithOnFile, WithRename } from "./common.svelte.js";
  import EditableName, { nameEdit } from "./EditableName.svelte";
  import FsContextMenu, { type WithGetItems } from "./FsContextMenu.svelte";
  import { file as _file, symlink } from "./Icons.svelte";

  type WithMinimalFile = {
    file: Pick<TFileLike, "name" | "path" | "type" | "focused" | "editing">;
  };

  let {
    file,
    rename,
    getItems,
    onFileClick,
    onFileMouseEnter,
    onFileMouseLeave,
  }: WithMinimalFile & WithGetItems & WithOnFile & WithRename = $props();

  let topLevel = $state<HTMLElement>();
  let nameUI = $state<EditableName>();
</script>

<FsContextMenu
  {nameUI}
  {getItems}
  item={file}
  type={file.type}
  target={topLevel}
  beforeAction={() => nameEdit.exit(file)}
/>

<button
  onclick={() => onFileClick(file)}
  onmouseenter={() => onFileMouseEnter(file)}
  onmouseleave={() => onFileMouseLeave(file)}
  class="relative flex w-full rounded-sm"
  class:focused={file.focused}
  bind:this={topLevel}
>
  <span class="w-full flex flex-row items-center gap-0.5">
    <div class="shrink-0">
      {#if file.type === "symlink"}
        {@render symlink()}
      {:else}
        {@render _file()}
      {/if}
    </div>
    <EditableName {rename} bind:this={nameUI} item={file} />
  </span>
</button>

<style>
  .focused {
    background-color: var(--focus-color);
  }
</style>
