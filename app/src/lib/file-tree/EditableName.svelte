<script lang="ts">
  import { mouseEventToCaretIndex } from "$lib/utils";
  import type { TBase } from "./Tree.svelte";

  let { name = $bindable(), rename }: Pick<TBase, "name" | "rename"> = $props();

  let editing = $state(false);
  let input = $state<HTMLInputElement>();
  let caretIndex = $state(-1);

  export const edit = <
    Condition extends true | false,
    Detail extends Condition extends true ? typeof caretIndex : typeof name,
  >(
    condition: Condition,
    detail: Detail,
  ) => {
    editing = condition;
    if (condition) caretIndex = detail as number;
    else rename(detail as string);
  };

  $effect(() => {
    if (!input) return;
    input.value = name;
    input.focus();
    if (caretIndex >= 0) input.setSelectionRange(caretIndex, caretIndex);
  });
</script>

<div>
  {#if editing}
    <input
      bind:this={input}
      type="text"
      onblur={({ currentTarget: { value } }) => edit(false, value)}
      onkeydown={({ key, currentTarget }) =>
        key !== "Enter" || currentTarget.blur()}
    />
  {:else}
    <span
      role="button"
      tabindex="0"
      ondblclick={(event) => edit(true, mouseEventToCaretIndex(event, name))}
    >
      {name}
    </span>
  {/if}
</div>

<style>
  input {
    border: none;
    background: transparent;
    font: inherit;
    padding: 0;
    margin: 0;
    width: 100%;
    outline: none;
  }

  input:focus {
    outline: 1px solid #007fd4;
  }
</style>
