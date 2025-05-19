<script lang="ts" module>
  import { TooltipSingleton } from "$lib/utils/tooltip.js";
  import NameOverflowTip from "./NameOverflow.svelte";
  import { focusColor, type WithRename } from "./common.svelte.js";

  const tooltip = new TooltipSingleton(NameOverflowTip);

  const focusedComposite = stringify.rgba(
    blend(parse.rgba(focusColor)!, boost(colors.black, 40)),
  );

  type Item = Parameters<WithRename["rename"]>[1];
  export type EditStatus = "valid" | "invalid" | "unsafe";
  type EditCallback = (
    value: string,
    done?: true,
  ) => EditStatus | Promise<EditStatus>;
  type EditOptions = Pick<Item["editing"], "caretIndex" | "override"> & {
    callback?: EditCallback;
    validate?: (value: string) => boolean;
  };

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

  const editCallbacks = new Map<Item, EditCallback>();

  export const nameEdit = {
    begin: (
      item: Item,
      {
        caretIndex = undefined,
        override = undefined,
        callback,
      }: EditOptions = {},
    ) => {
      set(item, true, override, caretIndex);
      if (callback) editCallbacks.set(item, callback);
    },
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
  let status = $state<EditStatus>();
  const value = $derived(item.editing.override ?? item.name);
  const caretIndex = $derived(item.editing.caretIndex ?? item.name.length);

  export const highlight = (setting?: boolean) => {
    setting ??= !highlighted;
    highlighted = setting;
  };

  let editCallback: EditCallback | undefined;

  const updateEditStatus = (value: string) => {
    if (!editCallback) return (status = "valid");
    const result = editCallback?.(value);
    if (result instanceof Promise) result.then((s) => (status = s));
    else status = result;
  };

  const notifyDoneEditing = (value: string) => {
    editCallback?.(value, true);
    editCallback = undefined;
  };

  $effect(() => {
    if (!item.editing.condition) return;
    editCallback = editCallbacks.get(item);
    editCallbacks.delete(item);
    updateEditStatus(value);
  });

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
    class:invalid={status === "invalid"}
    class:unsafe={status === "unsafe"}
    onblur={({ currentTarget }) => {
      // NOTE: some issues have been observed where on blur is called immediately for some reason...
      notifyDoneEditing(currentTarget.value);
      nameEdit.exit(item);
    }}
    oninput={({ currentTarget }) => updateEditStatus(currentTarget.value)}
    onkeydown={(event) => {
      const { key, currentTarget } = event;
      const { value: update } = currentTarget;
      switch (key) {
        case " ":
          event.preventDefault();
          const cursorPos = currentTarget.selectionStart;
          if (cursorPos === null) break;
          const newValue =
            update.slice(0, cursorPos) + " " + update.slice(cursorPos);
          currentTarget.value = newValue;
          currentTarget.setSelectionRange(cursorPos + 1, cursorPos + 1);
          updateEditStatus(newValue);
          break;
        case "Enter":
          notifyDoneEditing(update);
          const valid = Boolean(update !== item.name && update.trim());
          if (valid && status !== "invalid") rename(update, item);
          else status = "valid";
          currentTarget.blur();
          break;
        case "Escape":
          notifyDoneEditing(update);
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
  input {
    transition: outline-color 300ms linear;
  }
  .highlighted,
  input:focus {
    outline-color: #007fd4;
  }

  input:focus.invalid {
    outline-color: #ff0000;
  }

  input:focus.unsafe {
    outline-color: #ffa500;
  }
</style>
