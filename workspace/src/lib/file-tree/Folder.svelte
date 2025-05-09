<script lang="ts">
  import {
    type WithOnFileClick,
    type TFolder,
    tryRenameAt,
    writeChild,
    type WithWrite,
  } from "./Tree.svelte";
  import type { Props } from "$lib/utils/ui-framework.js";
  import File from "./File.svelte";
  import Self from "./Folder.svelte";
  import { fade } from "svelte/transition";
  import OpenFolder from "./svgs/OpenFolder.svelte";
  import ClosedFolder from "./svgs/ClosedFolder.svelte";
  import EditableName from "./EditableName.svelte";
  import FsContextMenu from "./FsContextMenu.svelte";
  import { untrack } from "svelte";
  import FolderSlideTransition from "./utils/folder-slide-transition.js";
  let {
    expanded = false,
    name = $bindable(),
    path,
    rename,
    focused,
    children,
    remove: _delete,
    onFileClick,
    write,
    editing,
  }: TFolder &
    WithOnFileClick & { editing: boolean } & Props<typeof EditableName> &
    WithWrite = $props();

  let nameUI = $state<EditableName>();
  let topLevel = $state<HTMLElement>();
  let expandOn: string | undefined;
  let editingTarget = $state<string>();

  $effect(() => {
    children.sort((a, b) => a.name.localeCompare(b.name));
    if (expandOn && children.some(({ path }) => path === expandOn)) {
      expanded = true;
      editingTarget = expandOn;
    }
    expandOn = undefined;
  });

  const add = async (type: "file" | "folder") =>
    (expandOn = writeChild(children, type, path, write));

  $effect(() => {
    if (!editing) return;
    untrack(() => {
      nameUI?.highlight();
      nameUI?.edit(true, 0, "");
    });
  });

  let childContainer: HTMLElement;
  let folderSlider: FolderSlideTransition | undefined;

  $effect(() => {
    folderSlider ??= new FolderSlideTransition(childContainer);
    folderSlider.fire(expanded);
  });
</script>

<FsContextMenu
  addFile={() => add("file")}
  addFolder={() => add("folder")}
  {nameUI}
  remove={_delete}
  target={topLevel}
  {name}
  beforeAction={() => nameUI?.edit(false, name)}
/>

<button
  onclick={() => (expanded = !expanded)}
  class:focused
  class="relative flex w-full"
  bind:this={topLevel}
>
  <span class="w-full flex items-center gap-0.5">
    <div class="shrink-0">
      {#if expanded}
        <OpenFolder />
      {:else}
        <ClosedFolder />
      {/if}
    </div>
    <EditableName bind:name {rename} bind:this={nameUI} />
  </span>
</button>

<div bind:this={childContainer}>
  {#if expanded}
    <ul out:fade={{ duration: FolderSlideTransition.DurationMs + 100 }}>
      {#each children as child, index}
        {@const rename: typeof child.rename = (...args) => tryRenameAt(children, index, ...args)}
        <li>
          {#if child.type === "folder"}
            <Self
              {...child}
              {rename}
              {onFileClick}
              {write}
              editing={editingTarget === child.path}
              bind:name={child.name}
            />
          {:else}
            {@const onclick = () => onFileClick(child)}
            <File
              {...child}
              {rename}
              bind:name={child.name}
              {onclick}
              editing={editingTarget === child.path}
            />
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

  .focused {
    background-color: rgba(255, 255, 255, 0.3);
  }
</style>
