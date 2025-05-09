<script lang="ts" module>
  type Port = number;
  export type PortPath =
    | `${Port}`
    | `${Port}/${string}`
    | `${Port}?${string}`
    | `${Port}?${string}&${string}`;

  export type Props = {
    initial: {
      port: number;
      url: string;
    };
    path?: PortPath;
  };
  let tracker = Number.MIN_SAFE_INTEGER;
</script>

<script lang="ts">
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import { onDestroy, onMount, untrack } from "svelte";

  let { params, api, containerApi }: PanelProps<"dock", Props> = $props();

  const { port, url } = params.initial;

  const id = `preview-frame-${++tracker}`;

  const src = $derived.by(() => {
    console.log("derive");
    if (!params.path) return url;
    const [_, location] = params.path.split(`${port}`);
    return url + location;
  });

  let container: HTMLDivElement;
  let iframe: HTMLIFrameElement;

  window.addEventListener("blur", () => {
    if (document.activeElement === iframe && !api.isActive) {
      api.setActive();
      console.log("set active");
    }
  });

  onMount(() => {
    iframe = document.getElementById(id) as HTMLIFrameElement;
    console.log({ iframe });
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = id;
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.src = src;
      container.appendChild(iframe);
    }
  });

  onDestroy(() => {
    console.log(container.children);
  });
</script>

{"h"}
<MountedDiv class="w-full h-full" bind:element={container} />
