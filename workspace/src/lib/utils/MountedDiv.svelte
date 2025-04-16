<script lang="ts">
  import { onMount } from "svelte";

  type Props = {
    class?: string;
    style?: string;
    onMount?: (element: HTMLDivElement) => void;
    element?: HTMLDivElement;
  };

  let {
    class: _class,
    style,
    onMount: mount,
    element = $bindable(),
  }: Props = $props();

  if (mount) onMount(() => mount(element!));
</script>

<div bind:this={element} class={_class ?? ""} style={style ?? ""}></div>
