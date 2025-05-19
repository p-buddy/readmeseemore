<script lang="ts" module>
  import {
    type PanelProps,
    GridView,
    type WithViewOnReady,
  } from "@p-buddy/dockview-svelte";
  import type { IDisposable } from "@xterm/xterm";
  import MountedDiv from "$lib/utils/MountedDiv.svelte";
  import { type Props as PropsOf } from "$lib/utils/svelte.js";
  import type { WithElements } from "./index.js";
  import {
    animateEntry,
    animateExit,
    defaultDuration,
    panelConfig,
    type ViewHelper,
  } from "$lib/utils/dockview.js";
  import {
    getTerminalContextItems,
    type OperatingSystem,
    type Terminal,
  } from "$lib/operating-system/index.js";
  import { register as registerContextMenu } from "../context-menu/index.js";

  type Panels = {
    terminal: typeof terminal;
  };

  export type View = ViewHelper<"grid", Panels>;

  export const open = async (
    os: OperatingSystem,
    api: View["api"],
    terminal: Terminal,
    reference?: string,
  ) => {
    let fit: IDisposable;
    let config = panelConfig(api).id(terminal.id).size(0);
    if (reference) config.direction("right").reference(reference);
    const { panel } = await api.addSnippetPanel(
      "terminal",
      {
        onMount(element) {
          terminal.mount(element, defaultDuration + 200);
          registerContextMenu(element, {
            props: () =>
              getTerminalContextItems(os!, terminal, (onDropped) => {
                fit.dispose();
                terminal.fade("out", defaultDuration - 100);
                animateExit(api, panel, onDropped);
              }),
          });
        },
        style: "height: 100%; padding: 10px;",
      },
      config.options,
    );
    fit = panel.api.onDidDimensionsChange(() => terminal.fit());
    animateEntry(api, panel);
  };

  export type Props = WithViewOnReady<"grid", Panels> &
    WithElements<"terminals">;

  export { terminals };
</script>

{#snippet terminal(props: PanelProps<"grid", PropsOf<typeof MountedDiv>>)}
  <!-- Margin right used to ensure terminal's scrollbar overlap hack works -->
  <MountedDiv {...props.params} class="mr-4" />
{/snippet}

{#snippet terminals({ params }: PanelProps<"grid", Props>)}
  <div class="w-full h-full pb-1" bind:this={params.elements.terminals}>
    <GridView {...params} snippets={{ terminal }} orientation={"HORIZONTAL"} />
  </div>
{/snippet}
