<script lang="ts">
  import type { WithOnFileClick, TFolder } from "./Tree.svelte";
  import type { Props } from "$lib/utils/ui-framework";
  import File from "./File.svelte";
  import Self from "./Folder.svelte";
  import { slide } from "svelte/transition";
  import OpenFolder from "./svgs/OpenFolder.svelte";
  import ClosedFolder from "./svgs/ClosedFolder.svelte";
  import EditableName from "./EditableName.svelte";
  import SingleClickButton from "./SingleClickButton.svelte";
  import FsContextMenu from "./FsContextMenu.svelte";

  let {
    expanded = false,
    name = $bindable(),
    rename,
    focused,
    children,
    delete: _delete,
    onFileClick,
  }: TFolder & WithOnFileClick & Props<typeof EditableName> = $props();

  let nameUI = $state<EditableName>();
  let topLevel = $state<HTMLElement>();

  $effect(() => {
    children.sort((a, b) => a.name.localeCompare(b.name));
  });
</script>

<FsContextMenu {nameUI} delete={_delete} target={topLevel} {name} />

<button
  onclick={() => (expanded = !expanded)}
  class:focused
  class="relative flex w-full"
  bind:this={topLevel}
>
  {#if expanded}
    <OpenFolder />{:else}
    <ClosedFolder />{/if}
  <EditableName bind:name {rename} bind:this={nameUI} />
</button>

{#if expanded}
  <ul transition:slide={{ duration: 300 }}>
    {#each children as child}
      {@const rename = child.rename.bind(child)}
      <li>
        {#if child.type === "folder"}
          <Self {...child} {rename} bind:name={child.name} {onFileClick} />
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
