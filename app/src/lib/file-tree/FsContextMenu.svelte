<script lang="ts">
  import ContextMenu from "$lib/ContextMenu.svelte";
  import type { OnClick } from "$lib/utils";
  import type { Props as ComponentProps } from "$lib/utils/ui-framework";
  import type EditableName from "./EditableName.svelte";
  import { mount, unmount } from "svelte";
  import type { TTreeItem } from "./Tree.svelte";

  type Props = {
    nameUI?: EditableName;
    open?: OnClick;
    target?: HTMLElement;
  } & Pick<TTreeItem, "name" | "delete">;

  let { nameUI, open, delete: _delete, name, target }: Props = $props();
  let contextMenu: ContextMenu;

  const onMenuClick =
    (fn: OnClick): OnClick =>
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      fn(event);
      unmount(contextMenu);
    };

  const items: ComponentProps<typeof ContextMenu>["items"] = [
    ...(open
      ? [
          {
            content: opener,
            onclick: onMenuClick(open),
          },
        ]
      : []),
    {
      content: renamer,
      onclick: onMenuClick(() => nameUI?.edit(true, name.split(".")[0].length)),
    },
    {
      content: deleter,
      onclick: onMenuClick(_delete),
    },
  ];

  $effect(() => {
    if (!target) return;
    target.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      contextMenu = mount(ContextMenu, {
        target: target,
        props: { items },
      });
    });
  });

  const hide = () => {
    if (contextMenu) unmount(contextMenu);
  };
</script>

<svelte:window onclick={hide} />

{#snippet renamer()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
    />
  </svg>

  Rename
{/snippet}

{#snippet opener()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z"
    />
  </svg>

  Open
{/snippet}

{#snippet deleter()}
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class="size-5"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
    />
  </svg>

  Delete
{/snippet}
