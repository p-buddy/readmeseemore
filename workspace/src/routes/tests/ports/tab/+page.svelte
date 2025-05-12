<script lang="ts">
  import { Ports, Tab } from "$lib/ports/index.js";
  import { DockView } from "@p-buddy/dockview-svelte";
</script>

{#snippet dummy()}
  <div>
    <h1>Dummy</h1>
  </div>
{/snippet}

<div class="w-screen h-screen">
  <DockView
    snippets={{ dummy }}
    tabs={{
      components: {
        Tab,
      },
    }}
    onReady={({ api }) => {
      const ports = Ports.Create();
      ports.add(1234);
      api.addSnippetPanel(
        "dummy",
        {},
        {
          title: "1234",
          id: "1234",
          tabComponent: "Tab",
        },
      );
      api.addSnippetPanel(
        "dummy",
        {},
        {
          title: "2234",
          id: "2234",
          tabComponent: "Tab",
        },
      );
    }}
  />
</div>
