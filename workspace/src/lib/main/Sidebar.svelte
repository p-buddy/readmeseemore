<script lang="ts" module>
  import {
    type PanelProps,
    PaneView,
    type WithViewOnReady,
  } from "@p-buddy/dockview-svelte";
  import {
    FileTree,
    type FileTreeLimitedFs,
    type FileTreeProps,
  } from "$lib/file-tree/index.js";
  import { PortsList, type PortsListProps } from "$lib/ports/index.js";
  import { panelConfig, type ViewHelper } from "$lib/utils/dockview.js";
  import type { WithElements } from "./index.js";

  type Panels = {
    FileTree: typeof FileTree;
    PortsList: typeof PortsList;
  };

  export type View = ViewHelper<"pane", Panels>;

  type Added<K extends keyof Panels> = Awaited<
    ReturnType<(_: View["api"]) => ReturnType<typeof _.addComponentPanel<K>>>
  >;

  export type AddedPortsList = Added<"PortsList">;

  export const added = {
    portsList: undefined as AddedPortsList | undefined,
  };

  type Props = WithViewOnReady<"pane", Panels> & WithElements<"tree">;

  export const open = {
    portsList: async (api: View["api"], props: PortsListProps) => {
      added.portsList ??= await api
        .addComponentPanel(
          "PortsList",
          props,
          panelConfig<"pane">().title("Ports").options,
        )
        .then((list) => {
          list.panel.api.setExpanded(true);
          return list;
        });
      return added.portsList!;
    },
    fileTree: async (
      api: View["api"],
      fs: FileTreeLimitedFs,
      props: FileTreeProps,
    ) => {
      const tree = await api.addComponentPanel(
        "FileTree",
        props,
        panelConfig<"pane">().title("Explorer").isExpanded(true).options,
      );
      tree.panel.headerVisible = false;
      await tree.exports.root.populate(fs);
      return tree;
    },
  };

  export { sidebar };
</script>

{#snippet sidebar({ params }: PanelProps<"grid", Props>)}
  <div class="w-full h-full" bind:this={params.elements.tree}>
    <PaneView components={{ FileTree, PortsList }} {...params} />
  </div>
{/snippet}
