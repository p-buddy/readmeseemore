<script lang="ts" module>
  import { onContextMenu } from "$lib/context-menu/index.js";
  import { onDestroy, type Snippet } from "svelte";
  import Item from "./Item.svelte";

  type TextOrSnippet = string | Snippet;

  class State {
    open = $state(false);
  }

  type MenuHeader = {
    content: TextOrSnippet;
    children: MenuHeader[];
  };

  export type MenuItem = {
    content: TextOrSnippet;
    state?: State;
  } & (
    | {
        shortcut?: string;
        onClick?: () => void;
      }
    | {
        children: MenuItem[];
      }
  );

  const tryInit = (item: MenuItem) => {
    item.state ??= new State();
  };
</script>

<script>
  // Menu structure with items and their dropdowns
  const menus: { name: string; items: MenuItem[] }[] = [
    {
      name: "File",
      items: [
        { content: "New Finder Window", shortcut: "⌘ N" },
        { content: "New Folder", shortcut: "⇧ ⌘ N" },
        {
          content: "New Folder with *Screenshot 2025-05-01 at 12.16.34 PM*",
          shortcut: "⌥ ⌘ N",
        },
        { content: "New Smart Folder", shortcut: "" },
        { content: "New Tab", shortcut: "⌘ T" },
        { content: "Open" },
        {
          content: "Open With",
          shortcut: "",
          children: [
            { content: "hi" },
            { content: "hello", children: [{ content: "yes" }] },
          ],
        },
        { content: "Close Window", shortcut: "⌘ W" },
        { content: "Get Info", shortcut: "⌘ I" },
        { content: "Rename", shortcut: "" },
        { content: "Compress", shortcut: "" },
      ],
    },
    {
      name: "Edit",
      items: [
        { content: "Undo", shortcut: "⌘ Z" },
        { content: "Redo", shortcut: "⇧ ⌘ Z" },
        { content: "Cut", shortcut: "⌘ X" },
        { content: "Copy", shortcut: "⌘ C" },
        { content: "Paste", shortcut: "⌘ V" },
        { content: "Select All", shortcut: "⌘ A" },
      ],
    },
    {
      name: "View",
      items: [
        { content: "as Icons", shortcut: "⌘ 1" },
        { content: "as List", shortcut: "⌘ 2" },
        { content: "as Columns", shortcut: "⌘ 3" },
        { content: "as Gallery", shortcut: "⌘ 4" },
      ],
    },
    {
      name: "Go",
      items: [
        { content: "Back", shortcut: "⌘ [" },
        { content: "Forward", shortcut: "⌘ ]" },
        { content: "Computer", shortcut: "⇧ ⌘ C" },
        { content: "Home", shortcut: "⇧ ⌘ H" },
        { content: "Documents", shortcut: "⇧ ⌘ D" },
      ],
    },
    {
      name: "Window",
      items: [
        { content: "Minimize", shortcut: "⌘ M" },
        { content: "Zoom", shortcut: "" },
        { content: "Tile Window to Left of Screen", shortcut: "" },
        { content: "Tile Window to Right of Screen", shortcut: "" },
      ],
    },
    {
      name: "Help",
      items: [
        { content: "Search", shortcut: "" },
        { content: "Finder Help", shortcut: "⌘ ?" },
      ],
    },
  ];

  let container: HTMLDivElement;
  let isOpen = $state(false);
  let index = $state(0);

  const tryHandleClickOutside = ({ target }: MouseEvent) => {
    if (target instanceof Node && !container.contains(target)) isOpen = false;
  };

  onDestroy(onContextMenu(tryHandleClickOutside));
</script>

<svelte:window onclick={tryHandleClickOutside} />

<div
  bind:this={container}
  class="w-full text-neutral-200 bg-neutral-700 select-none text-sm font-medium"
>
  <div class="menu-bar flex items-center mx-1">
    <!-- Menu items -->
    {#each menus as menu, i}
      {@const open = isOpen && i === index}
      <button
        class="text-left relative flex flex-row items-center cursor-default hover:bg-neutral-500 px-3 first:pl-2 gap-2 py-0.5 rounded-sm *:hidden"
        class:open
        class:bg-neutral-500={open}
        onclick={() => {
          index = i;
          isOpen = !isOpen;
        }}
        onmouseenter={() => {
          if (!isOpen) return;
          index = i;
        }}
      >
        {menu.name}
        <div
          class="absolute top-full z-100 left-0 p-1 space-y-0.5 border-1 rounded-sm border-neutral-600 bg-neutral-800"
          style:min-width={`220px`}
        >
          {#each menu.items as item}
            <Item {item} />
          {/each}
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .open {
    @apply *:block;
  }
</style>
