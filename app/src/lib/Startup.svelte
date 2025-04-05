<script lang="ts">
  import { untrack } from "svelte";
  import Shimmer from "./Shimmer.svelte";
  import Status from "./Status.svelte";

  type Props = {
    completed: boolean;
    messages: string[];
  };

  let { completed, messages }: Props = $props();

  let expanded = $state(true);

  $effect(() => {
    if (completed) untrack(() => (expanded = false));
  });
</script>

<button
  type="button"
  class="flex items-center justify-between w-full p-4 rtl:text-right text-gray-500 border border-gray-200 rounded-t-xl dark:border-gray-700 dark:text-gray-400 gap-3 font-semibold transition-all duration-500"
  class:rounded-b-xl={!expanded}
  onclick={() => (expanded = !expanded)}
>
  <span
    >{#if !completed}
      <Shimmer>Starting up...</Shimmer>
    {:else}
      Startup complete
    {/if}</span
  >
  <svg
    class="w-3 h-3 shrink-0 transition-transform duration-200"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 10 6"
    class:rotate-180={!expanded}
  >
    <path
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 5 5 1 1 5"
    />
  </svg>
</button>
<div
  class="transition-all duration-500 border border-b-0 w-full border-gray-200 dark:border-gray-700 dark:bg-gray-900 rounded-b-xl max-h-full"
  class:opacity-0={!expanded}
  class:max-h-0={!expanded}
>
  <div
    class="transition-all duration-500 overflow-hidden"
    class:h-50={expanded}
    class:h-0={!expanded}
  >
    <Status {messages} {completed} />
  </div>
</div>
