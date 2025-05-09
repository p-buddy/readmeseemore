<script lang="ts" module>
  type Props = {
    open: (port: number) => void;
  };
</script>

<script lang="ts">
  import type { OnlyRequire } from "$lib/utils/index.js";
  import type { PanelProps } from "@p-buddy/dockview-svelte";
  import { SvelteSet } from "svelte/reactivity";

  let { params }: OnlyRequire<PanelProps<"pane", Props>, "params"> = $props();

  const ports = new SvelteSet<number>();

  export const addPort = (port: number) => ports.add(port);
  export const removePort = (port: number) => ports.delete(port);

  let selected = $state<number>();

  export const select = (port: number) => {
    if (ports.has(port)) {
      if (selected === port) return;
      selected = port;
    } else {
      if (!selected) return;
      selected = undefined;
    }
  };
</script>

<div>
  {#each ports as port}
    <button onclick={() => params.open(port)}>{port}</button>
  {/each}
</div>
