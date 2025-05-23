<script lang="ts" module>
  import { TooltipSingleton } from "$lib/utils/tooltip.js";
  import NameOverflowTip from "./NameOverflow.svelte";

  const tooltip = new TooltipSingleton(NameOverflowTip);

  const selectedBg = "rgba(255, 255, 255, 0.3)";
  const selectedRGBA = parse.rgba(selectedBg)!;
  const selectedComposite = stringify.rgba(
    blend(selectedRGBA, boost(colors.black, 40)),
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
    else {
      highlight(false);
      rename(detail as string);
    }
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
    class="relative outline outline-transparent flex-grow text-left overflow-x-hidden overflow-ellipsis whitespace-nowrap"
    class:highlighted
    tabindex="0"
    ondblclick={(event) => edit(true, mouseEventToCaretIndex(event, name))}
    onmouseenter={({ currentTarget: current }) => {
      if (!isEllipsisActive(current)) return;
      const bg = findNearestBackgroundColor(current);
      const { destroy, component } = tooltip.mount(
        fixToTopLeftCorner(current, { zIndex: "10000" }),
        {
          name,
          background: bg === selectedBg ? selectedComposite : bg,
          onclick: () => {
            current.click();
            component.setBackground(selectedComposite);
          },
          ondblclick: async (event) => {
            edit(true, mouseEventToCaretIndex(event, name, false));
            destroy();
          },
          onmouseleave: () => destroy(),
        },
      );
    }}
  >
    <span class="w-fit">
      {name}
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
