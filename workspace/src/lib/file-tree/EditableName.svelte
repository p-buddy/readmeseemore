<script lang="ts" module>
  import { TooltipSingleton } from "$lib/utils/tooltip.js";
  import NameOverflowTip from "./NameOverflow.svelte";
  import {
    focusColor,
    type TTreeItem,
    type WithRename,
  } from "./common.svelte.js";

  const tooltip = new TooltipSingleton(NameOverflowTip);

  const focusedComposite = stringify.rgba(
    blend(parse.rgba(focusColor)!, boost(colors.black, 40)),
  );

  type Item = Pick<TTreeItem, "name" | "path" | "editing" | "type">;
  type EditOptions = Pick<Item["editing"], "caretIndex" | "override">;

  const set = (
    item: Item,
    condition: boolean,
    override?: string,
    caretIndex?: number,
  ) => {
    item.editing.condition = condition;
    item.editing.override = override;
    item.editing.caretIndex = caretIndex;
  };

  export const nameEdit = {
    begin: (
      item: Item,
      { caretIndex = undefined, override = undefined }: EditOptions = {},
    ) => set(item, true, override, caretIndex),
    /**
     * @description Exits the edit mode (WITHOUT saving)
     * @param item
     */
    exit: (item: Item) => set(item, false),
  };
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

  let { item, rename }: WithRename & { item: Item } = $props();

  let input = $state<HTMLInputElement>();
  let highlighted = $state(false);
  const value = $derived(item.editing.override ?? item.name);
  const caretIndex = $derived(item.editing.caretIndex ?? item.name.length);

  export const highlight = (setting?: boolean) => {
    setting ??= !highlighted;
    highlighted = setting;
  };

  $effect(() => {
    if (!input) return;
    input.focus();
    input.setSelectionRange(caretIndex, caretIndex);
  });
</script>

{#if item.editing.condition}
  <input
    bind:this={input}
    {value}
    type="text"
    class="bg-transparent outline outline-transparent border-none p-0 m-0 overflow-hidden"
    style:width="calc(100% - 1.25rem)"
    onblur={() => nameEdit.exit(item)}
    onkeydown={({ key, currentTarget }) => {
      switch (key) {
        case "Enter":
          const { value: update } = currentTarget;
          if (update !== item.name && update.trim()) rename(update, item);
          currentTarget.blur();
          break;
        case "Escape":
          nameEdit.exit(item);
          currentTarget.blur();
          break;
      }
    }}
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
    ondblclick={(event) =>
      nameEdit.begin(item, {
        caretIndex: mouseEventToCaretIndex(event, item.name),
      })}
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
            const caretIndex = mouseEventToCaretIndex(event, item.name, false);
            nameEdit.begin(item, { caretIndex });
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
</style>
