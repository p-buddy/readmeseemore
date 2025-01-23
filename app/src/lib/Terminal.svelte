<script lang="ts">
  import type { PanelPropsByView } from "./dockview-svelte";

  let props: PanelPropsByView<{}>["grid"] = $props();
</script>
