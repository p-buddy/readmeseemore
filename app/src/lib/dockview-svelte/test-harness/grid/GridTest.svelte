<script lang="ts">
  import { Orientation } from "dockview-core";
  import GridView from "../../GridView.svelte";
  import type { Component } from "svelte";
  import Legacy from "./LegacyPanel.svelte";
  import Runes from "./RunesPanel.svelte";
  import type { PanelComponentProps } from "../../utils.svelte";

  let props = $props();
</script>

{#snippet x(x: PanelComponentProps<"grid">)}
  <div>x</div>
{/snippet}

<GridView
  orientation={Orientation.HORIZONTAL}
  onReady={({ api }) => {}}
  components={{ Legacy, Runes }}
  snippets={{ x }}
/>
