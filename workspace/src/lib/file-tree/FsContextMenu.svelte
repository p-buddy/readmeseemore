<script lang="ts" module>
  type Snippets = {
    rename: typeof rename;
    openCode: typeof openCode;
    copyFile: typeof duplicate;
    addFile: typeof addFile;
    addFolder: typeof addFolder;
    deleter: typeof deleter;
    execute: typeof execute;
  };

  let snippets: Snippets;

  type FsItem = Pick<TTreeItem, "name" | "path" | "type" | "editing">;
  type ContextItemsReturn = Promise<ContextItems> | ContextItems;

  export interface GetContextItems {
    (
      type: "root",
      snippets: Snippets,
      item?: never,
      nameUI?: never,
    ): ContextItemsReturn;
    (
      type: FsItemType,
      snippets: Snippets,
      item: FsItem,
      nameUI: EditableName,
    ): ContextItemsReturn;
  }

  export type WithGetContextItems = { getContextItems: GetContextItems };

  type MenuType = FsItemType | "root";

  let executionDetails: string[] | undefined;

  /** TODO: Remove this when a better solution is implemented.
   *
   * Currently the snippets are expected to have no arguments, but for the execution of scripts from package.json,
   * the names of the scripts are needed.
   */
  export const setExecutionDetailHack = (details: string[]) => {
    executionDetails = details;
  };
</script>

<script lang="ts" generics="T extends MenuType">
  import {
    close,
    register,
    type Items as ContextItems,
  } from "$lib/context-menu/index.js";
  import { noop, type OnClick } from "$lib/utils/index.js";
  import type { FsItemType, TTreeItem } from "./common.svelte.js";
  import {
    plusFile,
    plusFolder,
    copy,
    trash,
    codeFile,
    pencil,
    run,
    getIconContext,
  } from "./Icons.svelte";
  import EditableName from "./EditableName.svelte";

  type Props = {
    target?: HTMLElement;
    atCursor?: boolean;
    beforeAction?: () => void;
    type: MenuType;
  } & WithGetContextItems &
    (T extends "root"
      ? { item?: never; nameUI?: never }
      : {
          item: FsItem;
          nameUI: EditableName | undefined;
        });

  let {
    item,
    type,
    nameUI,
    target,
    atCursor,
    beforeAction,
    getContextItems: getItems,
  }: Props = $props();

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
    copyFile: duplicate,
    addFile,
    addFolder,
    deleter,
    execute,
  };

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

{#snippet duplicate()}
  {@render copy()}
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

{#snippet execute()}
  {@render run()}
  Execute {executionDetails?.shift() ?? ""}
{/snippet}
