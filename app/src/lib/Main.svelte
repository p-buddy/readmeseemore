<script lang="ts">
  import { View, type PanelPropsByView } from "./dockview-svelte";
  import Terminal from "./Terminal.svelte";
  import mode from "./mode.svelte";
  import Tree from "./file-tree/Tree.svelte";
  import Editor from "./Editor.svelte";
  import { typedReactify } from "./utils/ui-framework";
  import VsCodeWatermark from "./VSCodeWatermark.svelte";
</script>

{#snippet pane()}
  <View type="pane" svelte={{ Tree }} onReady={({ api }) => {}} />
{/snippet}

{#snippet dock()}
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
{/snippet}

<View
  type="grid"
  className={mode.isDark ? "dockview-theme-dark" : "dockview-theme-light"}
  snippets={{ pane, dock }}
  svelte={{ Terminal }}
  proportionalLayout={false}
  onReady={async ({ api }) => {}}
/>
