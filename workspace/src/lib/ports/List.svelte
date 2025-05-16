<script lang="ts" module>
  import type { Port, WithPorts } from "./common.svelte.js";

  export type Props = WithPorts & {
    open: (port: Port) => void;
  };
</script>

<script lang="ts">
  import type { OnlyRequire } from "$lib/utils/index.js";
  import type { PanelProps } from "@p-buddy/dockview-svelte";

  let { params }: OnlyRequire<PanelProps<"pane", Props>, "params"> = $props();

  let selected = $state<Port>();

  export const select = (port?: Port) => {
    if (port !== undefined && params.ports.set.has(port)) {
      if (selected === port) return;
      selected = port;
    } else {
      if (!selected) return;
      selected = undefined;
    }
  };
</script>

<div class="w-full h-full text-sm font-medium">
  {#each params.ports.set as port}
    <button
      onclick={() => params.open(port)}
      class:bg-neutral-700={selected === port}
      class="inline-flex items-center w-full justify-center p-1 text-base font-medium text-neutral-400 hover:bg-neutral-700 hover:text-white"
    >
      <span class="w-full">{port} </span>
    </button>
  {/each}
</div>
