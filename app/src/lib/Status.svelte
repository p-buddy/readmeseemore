<script lang="ts">
  import { scale } from "svelte/transition";
  import LoadingToCheck from "./LoadingToCheck.svelte";

  type Props = {
    messages: string[];
    completed: boolean;
  };

  let { messages, completed }: Props = $props();

  let container = $state<HTMLElement>();

  $effect(() => {
    const last = messages.length - 1;
    container?.children[last]?.scrollIntoView({ behavior: "smooth" });
  });
</script>

<ul
  class="w-full h-full divide-y divide-gray-200 dark:divide-gray-700 overflow-y-scroll"
  bind:this={container}
>
  {#each messages as message, index}
    {@const checked = completed || index !== messages.length - 1}
    <li class="py-3" transition:scale={{ delay: 300 }}>
      <div class="flex items-center space-x-2">
        <div class="shrink-0 ml-2">
          <LoadingToCheck {checked} />
        </div>
        <div class="flex-1 text-gray-900 truncate dark:text-white">
          {message}
        </div>
      </div>
    </li>
  {/each}
</ul>
