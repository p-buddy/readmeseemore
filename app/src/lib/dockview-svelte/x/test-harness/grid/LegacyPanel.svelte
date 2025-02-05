<script lang="ts">
  import type { PanelComponentProps } from "../../utils.svelte";

  export let api: PanelComponentProps<"grid">["api"];
  export let containerApi: PanelComponentProps<"grid">["containerApi"];
  export let params: PanelComponentProps<"grid">["params"];
</script>
