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

  let {
    expanded = false,
    name = $bindable(),
    rename,
    children,
    onFileClick,
  }: TFolder & WithOnFileClick & Props<typeof EditableName> = $props();
</script>

<SingleClickButton onclick={() => (expanded = !expanded)}>
  {#if expanded}
    <OpenFolder />{:else}
    <ClosedFolder />{/if}
  <EditableName bind:name {rename} />
</SingleClickButton>

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
</style>
