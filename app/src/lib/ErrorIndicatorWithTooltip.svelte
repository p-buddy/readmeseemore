<script lang="ts">
  import { fade } from "svelte/transition";

  type Props = {
    msg: string;
    duration?: number;
  };

  let { msg, duration = 300 }: Props = $props();
</script>

<div
  class="has-tooltip text-red-500 overflow-visible"
  in:fade={{ duration }}
  out:fade={{ duration }}
>
  <span
    class="tooltip max-w-screen whitespace-nowrap right-0 p-2 mb-4 text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400"
    role="alert"
  >
    {msg}
  </span>
  <svg
    class="shrink-0 w-4 text-red-500"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
    />
  </svg>
</div>

<style>
  .tooltip {
    @apply invisible absolute opacity-0 transition-opacity duration-200;
  }

  .has-tooltip:hover .tooltip {
    @apply visible z-50 opacity-100;
  }
</style>
