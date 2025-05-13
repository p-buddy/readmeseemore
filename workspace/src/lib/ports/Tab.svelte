<script lang="ts" module>
  import { TooltipSingleton } from "$lib/utils/tooltip.js";
  import PortClosedTip from "./PortClosedTip.svelte";

  const tooltip = new TooltipSingleton(PortClosedTip);
</script>

<script lang="ts">
  import {
    DefaultDockTab,
    type DefaultDockTabProps,
  } from "@p-buddy/dockview-svelte";
  import { untrack } from "svelte";
  import { getPort, unique } from "./utils.js";
  import type { Props as PreviewProps } from "./Preview.svelte";
  import { type PortPath, Ports } from "./common.svelte.js";
  import { fixToBottomLeftCorner } from "$lib/utils/index.js";

  let props: Omit<DefaultDockTabProps, "content"> = $props();

  let editing = $state(false);
  let value = $state<string>();
  let input = $state<HTMLInputElement>();

  const setValueIfNotEditing = (update: string) => {
    if (!editing) untrack(() => (value = update));
  };

  const pathFromPort = (title: string, port?: number) =>
    port ? title.split(`${port}`)[1] : "";

  const updateParameters = (params: Partial<PreviewProps>) =>
    props.api.updateParameters(params);

  const update = (updated: PortPath) => {
    props.api.setTitle(updated);
    updateParameters({ path: unique(updated) });
  };

  let tip: ReturnType<typeof tooltip.mount> | undefined = undefined;
</script>

{#snippet icon(type: "browser" | "refresh" | "error")}
  {#if type === "browser"}
    <span class="size-4 text-neutral-500">
      <svg viewBox="0 0 192 192" xmlns="http://www.w3.org/2000/svg" fill="none">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g
          id="SVGRepo_tracerCarrier"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
        </g>
        <g id="SVGRepo_iconCarrier">
          <circle
            cx="96"
            cy="96"
            r="74"
            stroke="currentColor"
            stroke-width="12"
          >
          </circle>
          <ellipse
            cx="96"
            cy="96"
            stroke="currentColor"
            stroke-width="12"
            rx="30"
            ry="74"
          ></ellipse>
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="12"
            d="M28 72h136M28 120h136"
          >
          </path>
        </g>
      </svg>
    </span>
  {:else if type === "refresh"}
    <span class="h-full w-full">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
        <g
          id="SVGRepo_tracerCarrier"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
        </g>
        <g id="SVGRepo_iconCarrier">
          <path
            d="M21 3V8M21 8H16M21 8L18 5.29168C16.4077 3.86656 14.3051 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.2832 21 19.8675 18.008 20.777 14"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
          </path>
        </g>
      </svg>
    </span>
  {/if}
{/snippet}

{#snippet content(title: string)}
  {#if Boolean(title)}
    {@const port = getPort(title)}
    {@const path = pathFromPort(title, port)}
    {@const size = Math.max(value?.length ?? 0, 1)}
    {@const valid = Ports.Instance.set.has(port)}
    {setValueIfNotEditing(path)}
    <div class="flex flex-row items-center h-full">
      {#if valid}
        <button
          class="h-full w-3 mr-2 ml-0 text-neutral-50 hover:bg-neutral-700 ring-neutral-700 hover:ring-4 rounded-md transform active:scale-75 transition-transform"
          onclick={() => updateParameters({ path: unique(title as PortPath) })}
        >
          {@render icon("refresh")}
        </button>
      {/if}
      <div
        class="relative flex flex-row align-middle items-center outline-1 outline-neutral-600 rounded-xl py-0 pl-1"
        class:focus={editing}
        role="tooltip"
        onmouseenter={({ currentTarget: current }) => {
          if (valid) return;
          const zIndex = "1000";
          tip ??= tooltip.mount(fixToBottomLeftCorner(current, { zIndex }));
          tip.target.style.top = `${current.getBoundingClientRect().top + 30}px`;
        }}
        onmouseleave={() => {
          tip?.destroy();
          tip = undefined;
        }}
      >
        {@render icon("browser")}
        <div class="ml-1" class:text-red-400={!Ports.Instance.set.has(port)}>
          <button
            class="align-bottom pb-0 mb-0 h-full mx-auto cursor-text"
            onclick={() => {
              if (editing) return;
              if (!value) value = "/";
              editing = true;
              input?.focus();
            }}
          >
            {port}
          </button><!--force no space between--><input
            {size}
            class="outline-0"
            class:w-2={(value ?? "") === ""}
            bind:this={input}
            bind:value
            type="text"
            onclick={() => {
              if (editing) return;
              if (!value) value = "/";
              editing = true;
            }}
            onkeydown={(e) => {
              if (e.key === "Enter") {
                editing = false;
                update(`${port}${(value ?? path) as `/${string}`}`);
                input?.blur();
              } else if (
                e.key === "Backspace" &&
                (value?.length ?? 0) > 1 &&
                input?.selectionStart === 1
              ) {
                e.preventDefault();
                value = (value?.slice(0, 1) ?? "") + (value?.slice(2) ?? "");
              } else if (value && !value.startsWith("/")) value = "/" + value;
              else if (!value && e.key !== "/") value = "/";
            }}
            onblur={() => {
              editing = false;
              value = path;
            }}
          />
        </div>
      </div>
    </div>
  {/if}
{/snippet}

<DefaultDockTab {...props} {content} />

<style>
  .focus {
    outline-color: #007fd4;
  }
</style>
