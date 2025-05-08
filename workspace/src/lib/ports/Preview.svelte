<script lang="ts" module>
  export type Props = {
    url: string;
  };
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";

  let { params }: PanelProps<"dock", Props> = $props();

  const src = $derived.by(() => {
    if (!params.url) return;
    if (params.url.startsWith("http")) return params.url;
    if (params.url.startsWith("/")) return "http://localhost" + params.url;
    return "http://localhost/" + params.url;
  });
</script>

{#if params.url}
  <iframe {src} title="preview" class="w-full h-full"> </iframe>
{:else}
  <div class="w-full h-full flex items-center justify-center">
    <p class="text-center text-gray-500">No URL provided</p>
  </div>
{/if}
