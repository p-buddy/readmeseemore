<script lang="ts">
  import type { Folder } from ".";
  import File from "./File.svelte";
  import Self from "./Folder.svelte";
  import { slide } from "svelte/transition";
  import OpenFolder from "./svgs/OpenFolder.svelte";
  import ClosedFolder from "./svgs/ClosedFolder.svelte";

  let { expanded = false, name, files }: Folder = $props();

  function toggle() {
    expanded = !expanded;
  }
</script>

<button onclick={toggle} class="font-medium">
  {#if expanded}
    <OpenFolder />{:else}
    <ClosedFolder />{/if}
  {name}
</button>

{#if expanded}
  <ul transition:slide={{ duration: 300 }}>
    {#each files as file}
      <li>
        {#if file.type === "folder"}
          <Self {...file} />{:else}
          <File {...file} />{/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  button {
    background-size: 1em 1em;
    border: none;
    font-size: 14px;
    display: flex;
    gap: 3px;
    align-items: center;
    outline: none;
    background: transparent no-repeat;
  }
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
