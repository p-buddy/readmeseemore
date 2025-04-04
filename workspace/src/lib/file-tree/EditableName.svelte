<script lang="ts">
  import { mouseEventToCaretIndex } from "$lib/utils/index.js";
  import type { TBase } from "./Tree.svelte";

  let { name = $bindable(), rename }: Pick<TBase, "name" | "rename"> = $props();

  let editing = $state(false);
  let input = $state<HTMLInputElement>();
  let caretIndex = $state(-1);
  let highlighted = $state(false);
  let editableNameOverride: string | undefined;

  export const edit = <
    Condition extends true | false,
    Detail extends Condition extends true ? typeof caretIndex : typeof name,
  >(
    condition: Condition,
    detail: Detail,
    override?: string,
  ) => {
    editing = condition;
    editableNameOverride = override;
    if (condition) caretIndex = detail as number;
    else rename(detail as string);
  };

  export const highlight = (setting?: boolean) => {
    setting ??= !highlighted;
    highlighted = setting;
  };

  $effect(() => {
    if (!input) return;
    input.value = editableNameOverride ?? name;
    input.focus();
    if (caretIndex >= 0) input.setSelectionRange(caretIndex, caretIndex);
  });
</script>

{#if editing}
  <input
    bind:this={input}
    type="text"
    class="bg-transparent outline outline-transparent"
    style:width="calc(100% - 1.25rem)"
    onblur={({ currentTarget: { value } }) => edit(false, value)}
    onkeydown={({ key, currentTarget }) =>
      key !== "Enter" || currentTarget.blur()}
    onclick={(event) => {
      event.stopPropagation();
    }}
  />
{:else}
  <span
    role="button"
    class="outline outline-transparent flex-grow text-left"
    class:highlighted
    tabindex="0"
    ondblclick={(event) => edit(true, mouseEventToCaretIndex(event, name))}
  >
    <span class="w-fit">
      {name}
    </span>
  </span>
{/if}

<style>
  input:focus {
    outline-color: #007fd4;
  }
  input {
    /* Remove default border and padding */
    border: none;
    padding: 0;
    margin: 0;
    overflow: hidden;
  }
</style>
