<script lang="ts">
  import {
    DefaultDockTab,
    type DefaultDockTabProps,
  } from "@p-buddy/dockview-svelte";
  import { untrack } from "svelte";

  let props: Omit<DefaultDockTabProps, "content"> = $props();

  let editing = $state(false);
  let value = $state<string>();
  let input = $state<HTMLInputElement>();

  const setIfNotEditing = (title: string) => {
    if (editing) return;
    untrack(() => (value = title));
  };
</script>

{#snippet content(title: string)}
  {setIfNotEditing(title)}
  <input
    bind:this={input}
    bind:value
    type="text"
    class="outline-1 outline-neutral-600 rounded-xl pr-2 pl-3 cursor-text"
    onclick={() => (editing = true)}
    size={Math.max(value?.length ?? 0, 1)}
    onkeydown={(e) => {
      if (e.key !== "Enter") return;
      editing = false;
      input?.blur();
    }}
    onblur={() => {
      editing = false;
      value = title;
    }}
  />
{/snippet}

<DefaultDockTab {...props} {content} />

<style>
  input:focus {
    outline-color: #007fd4;
  }
</style>
