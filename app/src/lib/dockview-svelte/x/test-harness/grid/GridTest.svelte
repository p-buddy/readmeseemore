<script lang="ts">
  import { Orientation } from "dockview-core";
  import Gridview from "../../Gridview.svelte";
  import type { Component } from "svelte";
  import Legacy from "./LegacyPanel.svelte";
  import Runes from "./RunesPanel.svelte";
  import type { PanelComponentProps } from "../../utils.svelte";

  let props = $props();

  type z = Gridview<{}, { x: typeof x }>;

  type d = typeof x extends Component<any, any, any> ? true : false;
</script>

{#snippet x(x: PanelComponentProps<"grid">)}
  <div>x</div>
{/snippet}

<Gridview
  orientation={Orientation.HORIZONTAL}
  onReady={({ api }) => {}}
  components={{ Legacy, Runes }}
  snippets={{ x }}
/>
