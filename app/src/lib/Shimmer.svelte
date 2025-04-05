<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<span>{@render children()}</span>

<style>
  span {
    display: inline-block;
    -webkit-mask: linear-gradient(-60deg, #000 30%, #0005, #000 70%) right/300%
      100%;
    mask: linear-gradient(-60deg, #000 30%, #0005, #000 70%) right/300% 100%;
    background-repeat: no-repeat;
    animation: shimmer 2.5s infinite;
  }

  @keyframes shimmer {
    100% {
      -webkit-mask-position: left;
      mask-position: left;
    }
  }
</style>
