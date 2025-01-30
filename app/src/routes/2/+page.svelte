<script lang="ts">
  import Gridview, {
    type GridPanelProps,
  } from "$lib/dockview-svelte/x/Gridview.svelte";
  import type { ViewAPI } from "$lib/dockview-svelte/x/utils.svelte";
  import { Orientation } from "dockview-core";

  let props = $props();
</script>

{#snippet hi({ params }: GridPanelProps<{ msg: string }>)}
  <div>Hello {params.msg}</div>
{/snippet}

{#snippet nested({
  params,
}: GridPanelProps<{
  onReady: (api: { api: ViewAPI<"grid", {}, { hi: typeof hi }> }) => void;
}>)}
  <p>nested</p>
  <Gridview orientation={Orientation.VERTICAL} snippets={{ hi }} {...params} />
{/snippet}

<Gridview
  snippets={{ hi, nested }}
  orientation={Orientation.VERTICAL}
  onReady={({ api }) => {
    api.addSnippetPanel("nested", {
      onReady: ({ api: x }) => {
        console.log("nested onReady");
        x.addSnippetPanel(
          "hi",
          {
            msg: "againn",
          },
          {
            id: "hi3",
          },
        );
      },
    });
    api.addSnippetPanel("hi", {
      msg: "Hello",
    });

    api.addSnippetPanel(
      "hi",
      {
        msg: "World",
      },
      {
        id: "hi2",
      },
    );
  }}
/>
