<script lang="ts">
  import { mouseEventToCaretIndex } from "$lib/utils/index.js";
  import type { TBase } from "./Tree.svelte";

  let { name = $bindable(), rename }: Pick<TBase, "name" | "rename"> = $props();

  let editing = $state(false);
  let input = $state<HTMLInputElement>();
  let caretIndex = $state(-1);
  let highlighted = $state(false);

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

  export const highlight = (setting?: boolean) => {
    setting ??= !highlight;
    highlighted = setting;
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
      class="bg-transparent w-full outline outline-1 outline-transparent"
      onblur={({ currentTarget: { value } }) => edit(false, value)}
      onkeydown={({ key, currentTarget }) =>
        key !== "Enter" || currentTarget.blur()}
    />
  {:else}
    <span
      role="button"
      class="outline outline-1 outline-transparent"
      class:highlighted
      tabindex="0"
      ondblclick={(event) => edit(true, mouseEventToCaretIndex(event, name))}
    >
      {name}
    </span>
  {/if}
</div>

<style>
  input:focus,
  .highlighted {
    outline-color: #007fd4;
  }
</style>
