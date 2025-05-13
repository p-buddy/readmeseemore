<script lang="ts" module>
  import type { Port, PortPath } from "./common.svelte.js";

  export type Props = {
    initial: {
      port: Port;
      url: string;
    };
    path?: PortPath;
  };
</script>

<script lang="ts">
  import type { PanelProps } from "@p-buddy/dockview-svelte";

  let { params, api }: PanelProps<"dock", Props> = $props();

  const { port, url } = params.initial;

  const src = $derived.by(() => {
    if (!params.path) return url;
    const [_, location] = params.path.split(`${port}`);
    return url + location;
  });

  let iframe: HTMLIFrameElement;
</script>

<svelte:window
  onblur={() => {
    if (document.activeElement === iframe && !api.isActive) api.setActive();
  }}
/>

<iframe bind:this={iframe} {src} class="w-full h-full" title="Preview"></iframe>
