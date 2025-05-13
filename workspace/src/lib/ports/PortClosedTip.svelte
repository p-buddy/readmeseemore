<script lang="ts">
  import { fade } from "svelte/transition";
</script>

<div
  transition:fade={{ duration: 100 }}
  class="flex items-center text-sm px-1.5 py-0.5 z-1000 w-fit border bg-neutral-800 text-red-400 border-red-800 text-nowrap"
  role="alert"
>
  Port closed
</div>
