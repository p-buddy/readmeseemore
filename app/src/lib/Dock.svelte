<script lang="ts">
  import { View, type PanelPropsByView } from "./dockview-svelte";
  import Editor from "./Editor.svelte";
  import { typedReactify } from "./utils/ui-framework";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";

  let props: PanelPropsByView<{}>["grid"] = $props();
</script>

{#snippet preview({
  params: { url },
}: PanelPropsByView<{ url: string }>["dock"])}
  {/* @ts-ignore */ null}
  <iframe
    src={url}
    allow="cross-origin-isolated"
    credentialless
    title="preview"
  >
  </iframe>
{/snippet}

<View
  type="dock"
  svelte={{ Editor }}
  snippets={{ preview }}
  onReady={() => {}}
  watermarkComponent={typedReactify(VsCodeWatermark)}
/>
