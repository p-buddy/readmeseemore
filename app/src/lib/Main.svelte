<script lang="ts">
  import type { GridviewApi, IGridviewPanelProps } from "dockview";
  import mode from "./mode.svelte";
  import { View } from "./dockview-svelte/";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
  import Full from "./Full.svelte";

  let x = $state(0);
  let foo = $derived(`${x}`);
</script>

{#snippet test(y: IGridviewPanelProps<{ x: () => number }>)}
  <h1>{y.params.x()}</h1>
{/snippet}
{x}
<View
  type="grid"
  className={mode.isDark ? "dockview-theme-dark" : "dockview-theme-light"}
  svelte={{ Full }}
  snippets={{ test }}
  proportionalLayout={false}
  onReady={async ({ api }) => {
    api.addSnippetPanel("test", { x: () => x });
    api.addSveltePanel("Full", { foo });
    setInterval(() => {
      x += 1;
    }, 1000);
  }}
/>
