<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";

  let props: {
    open: (port: string) => void;
  } = $props();

  let selected = $state<string>();

  const ports = new SvelteSet<string>();

  export const addPort = (port: string) => ports.add(port);
  export const removePort = (port: string) => ports.delete(port);

  export const select = (port: string) => {
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
    <button onclick={() => props.open(port)}>{port}</button>
  {/each}
</div>
