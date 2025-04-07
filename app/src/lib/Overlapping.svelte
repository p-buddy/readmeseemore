<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<div
  class="grid grid-cols-1 grid-rows-1 [&>*]:col-start-1 [&>*]:col-end-1 [&>*]:row-start-1 [&>*]:row-end-1"
>
  {@render children()}
</div>
