<script lang="ts">
  import { View, type PanelPropsByView } from "./dockview-svelte";

  let props: PanelPropsByView<{}>["grid"] = $props();
</script>

<View type="pane" svelte={{}} onReady={() => {}} />
