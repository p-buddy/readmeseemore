<script lang="ts" module>
  type Snippets = {
    rename: typeof rename;
    openCode: typeof openCode;
    copyFile: typeof copyFile;
    addFile: typeof addFile;
    addFolder: typeof addFolder;
    deleter: typeof deleter;
  };

  let snippets: Snippets;

  type FsItem = Pick<TTreeItem, "name" | "path">;
  type ItemsReturn = Promise<Items> | Items;

  export interface GetItems {
    (
      type: "root",
      snippets: Snippets,
      item?: never,
      nameUI?: never,
    ): ItemsReturn;
    (
      type: FsItemType,
      snippets: Snippets,
      item: FsItem,
      nameUI: EditableName,
    ): ItemsReturn;
  }

  export type WithGetItems = { getItems: GetItems };

  type MenuType = FsItemType | "root";
</script>

<script lang="ts" generics="T extends MenuType">
  import { close, register, type Items } from "$lib/context-menu/index.js";
  import { noop, type OnClick } from "$lib/utils/index.js";
  import type { FsItemType, TTreeItem } from "./Tree.svelte";
  import {
    plusFile,
    plusFolder,
    fileCopy,
    trash,
    codeFile,
    pencil,
  } from "./Icons.svelte";
  import EditableName from "./EditableName.svelte";

  type Props = {
    target?: HTMLElement;
    atCursor?: boolean;
    beforeAction?: () => void;
    type: MenuType;
  } & WithGetItems &
    (T extends "root"
      ? { item?: never; nameUI?: never }
      : {
          item: Pick<TTreeItem, "name" | "path">;
          nameUI: EditableName | undefined;
        });

  let { item, type, nameUI, target, atCursor, beforeAction, getItems }: Props =
    $props();

  const onMenuClick =
    (fn: OnClick): OnClick =>
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      beforeAction?.();
      fn(event);
      close();
    };

  snippets ??= {
    rename,
    openCode,
    copyFile,
    addFile,
    addFolder,
    deleter,
  };

  /**
   * name
            ? () => nameUI?.edit(true, name.split(".")[0].length)
            : undefined,
   */

  $effect(() => {
    if (!target) return;
    register(
      target,
      {
        props: async () => {
          const items =
            type === "root"
              ? getItems(type, snippets)
              : item && nameUI
                ? getItems(type, snippets, item, nameUI)
                : undefined;
          if (!items) return { items: [{ content: error, onclick: noop }] };
          const resolved = Array.isArray(items) ? items : await items;
          for (const item of resolved) item.onclick = onMenuClick(item.onclick);
          return { items: resolved };
        },
        notAtCursor: () => !atCursor,
      },
      {
        onMount: item ? () => nameUI?.highlight(true) : undefined,
        onClose: item ? () => nameUI?.highlight(false) : undefined,
      },
    );
  });
</script>

{#snippet error()}
  Error
{/snippet}

{#snippet rename()}
  {@render pencil()}
  Rename
{/snippet}

{#snippet openCode()}
  {@render codeFile()}
  Open
{/snippet}

{#snippet deleter()}
  {@render trash()}
  Delete
{/snippet}

{#snippet copyFile()}
  {@render fileCopy()}
  Copy
{/snippet}

{#snippet addFile()}
  {@render plusFile()}
  Add File
{/snippet}

{#snippet addFolder()}
  {@render plusFolder()}
  Add Folder
{/snippet}
