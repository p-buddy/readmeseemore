<script lang="ts">
  import { onMount } from "svelte";

  type Props = {
    class?: string;
    style?: string;
    onMount: (root: HTMLDivElement) => void;
  };

  let { class: _class, style, onMount: _onMount }: Props = $props();
  let root: HTMLDivElement;

  onMount(() => _onMount(root));
</script>

<div bind:this={root} class={_class ?? ""} style={style ?? ""}></div>
