<script lang="ts">
  import {
    snippetNames,
    wrapper,
  } from "$lib/file-tree/ItemNameAnnotations.svelte";
</script>

{#each snippetNames as snippet}
  {@render wrapper({ type: "file", snippet, severity: "invalid" })}
{/each}
