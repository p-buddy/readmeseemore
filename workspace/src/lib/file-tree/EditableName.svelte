<script lang="ts" module>
  import { TooltipSingleton } from "$lib/utils/tooltip.js";
  import NameOverflowTip from "./NameOverflow.svelte";
  import { focusColor } from "./common.js";

  const tooltip = new TooltipSingleton(NameOverflowTip);

  const focusedComposite = stringify.rgba(
    blend(parse.rgba(focusColor)!, boost(colors.black, 40)),
  );
</script>

<script lang="ts">
  import {
    fixToTopLeftCorner,
    isEllipsisActive,
    mouseEventToCaretIndex,
  } from "$lib/utils/index.js";
  import {
    findNearestBackgroundColor,
    blend,
    parse,
    stringify,
    colors,
    boost,
  } from "$lib/utils/colors.js";
  import type { TTreeItem, WithRename } from "./Tree.svelte";

  let {
    item,
    rename,
  }: WithRename & { item: Pick<TTreeItem, "name" | "path" | "editing"> } =
    $props();

  let input = $state<HTMLInputElement>();
  let caretIndex = $state(-1);
  let highlighted = $state(false);

  const value = $derived(item.editing.override ?? item.name);

  export const edit = <
    Condition extends true | false,
    Detail extends Condition extends true
      ? typeof caretIndex
      : typeof item.name,
  >(
    condition: Condition,
    detail: Detail,
  ) => {
    item.editing.condition = condition;
    highlight(condition);
    if (condition) caretIndex = detail as number;
    else {
      const name = detail as string;
      item.editing.override = undefined;
      item.name = name;
      rename(name, item.path);
    }
  };

  export const highlight = (setting?: boolean) => {
    setting ??= !highlighted;
    highlighted = setting;
  };

  $effect(() => {
    if (!input) return;
    input.focus();
    if (caretIndex >= 0) input.setSelectionRange(caretIndex, caretIndex);
  });
</script>

{#if item.editing.condition}
  <input
    bind:this={input}
    {value}
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
    class="relative outline outline-transparent flex-grow text-left overflow-x-hidden overflow-ellipsis whitespace-nowrap"
    class:highlighted
    tabindex="0"
    ondblclick={(event) => edit(true, mouseEventToCaretIndex(event, item.name))}
    onmouseenter={({ currentTarget: current }) => {
      if (!isEllipsisActive(current)) return;
      const bg = findNearestBackgroundColor(current);
      const { destroy, component } = tooltip.mount(
        fixToTopLeftCorner(current, { zIndex: "10000" }),
        {
          name: item.name,
          background: bg === focusColor ? focusedComposite : bg,
          onclick: () => {
            current.click();
            component.setBackground(focusedComposite);
          },
          ondblclick: async (event) => {
            edit(true, mouseEventToCaretIndex(event, item.name, false));
            destroy();
          },
          onmouseleave: () => destroy(),
        },
      );
    }}
  >
    <span class="w-fit">
      {item.name}
    </span>
  </span>
{/if}

<style>
  .highlighted,
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
