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
  import { slide } from "svelte/transition";
  import OpenFolder from "./svgs/OpenFolder.svelte";
  import ClosedFolder from "./svgs/ClosedFolder.svelte";
  import EditableName from "./EditableName.svelte";
  import FsContextMenu from "./FsContextMenu.svelte";

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
  }: TFolder &
    WithOnFileClick &
    Props<typeof EditableName> &
    WithWrite = $props();

  let nameUI = $state<EditableName>();
  let topLevel = $state<HTMLElement>();

  $effect(() => {
    children.sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<FsContextMenu
  addFile={() => writeChild(children, "file", path, write)}
  addFolder={() => writeChild(children, "folder", path, write)}
  {nameUI}
  remove={_delete}
  target={topLevel}
  {name}
/>

<button
  onclick={() => (expanded = !expanded)}
  class:focused
  class="relative flex w-full"
  bind:this={topLevel}
>
  <span class="w-fit flex items-center gap-0.5">
    {#if expanded}
      <OpenFolder />{:else}
      <ClosedFolder />{/if}
    <EditableName bind:name {rename} bind:this={nameUI} />
  </span>
</button>

{#if expanded}
  <ul transition:slide={{ duration: 300 }}>
    {#each children as child, index}
      {@const rename: typeof child.rename = (...args) => tryRenameAt(children, index, ...args)}
      <li>
        {#if child.type === "folder"}
          <Self
            {...child}
            {rename}
            {onFileClick}
            {write}
            bind:name={child.name}
          />
        {:else}
          {@const onclick = () => onFileClick(child)}
          <File {...child} {rename} bind:name={child.name} {onclick} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}

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
