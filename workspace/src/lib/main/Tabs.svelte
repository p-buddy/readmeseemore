<script lang="ts" module>
  import {
    type PanelProps,
    DockView,
    type WithViewOnReady,
  } from "@p-buddy/dockview-svelte";
  import { Editor, type EditorProps } from "$lib/code-editor/index.js";
  import {
    unique,
    Ports,
    Preview,
    PreviewTab,
    type PreviewProps,
  } from "$lib/ports/index.js";
  import { panelConfig, type ViewHelper } from "$lib/utils/dockview.js";
  import type FilePanelTracker from "$lib/utils/FilePanelTracker.js";
  import VsCodeWatermark from "../VSCodeWatermark.svelte";
  import type { WithElements } from "./index.js";

  export type Panels = {
    Preview: typeof Preview;
    Editor: typeof Editor;
  };

  export type View = ViewHelper<"dock", Panels>;

  type PreviewDetails = Partial<Record<"title" | "url", string>>;

  export const open = {
    code: async (
      api: View["api"],
      props: EditorProps,
      codePanelTracker: FilePanelTracker,
    ) => {
      const id = `${codePanelTracker.add(props.file.path)}`;
      const existing = api!.getPanel(id);
      if (existing) return existing.api.setActive();
      const { options } = panelConfig<"dock">().id(id).title(props.file.name);
      const fresh = await api!.addComponentPanel("Editor", props, options);
      fresh.panel.api.setActive();
    },
    preview: (
      api: View["api"],
      ports: Ports,
      port: number,
      details?: PreviewDetails,
    ) => {
      ports.add(port);
      if (details?.url) ports.url(port, details.url);
      const title = details?.title ?? `${port}`;
      const url = ports.url(port);
      if (!url) throw new Error(`No url for port ${port}`);
      const { options } = panelConfig<"dock">()
        .id(ports.getPanelID(port))
        .title(title)
        .tabComponent("PreviewTab")
        .renderer("always")
        .direction("right");
      const initial = { url: unique(url), port };
      return api.addComponentPanel("Preview", { initial }, options);
    },
  };

  export const utils = {
    uniquePreviewProps: (url: string, port: number): PreviewProps => ({
      initial: { url: unique(url), port },
    }),
    previewPanelFilter:
      (port: number) =>
      ({ id }: Pick<View["api"]["panels"][number], "id">) =>
        Ports.PanelIDToPort(id) === port,
  };

  type Props = WithViewOnReady<"dock", Panels> & WithElements<"dock">;

  export { tabs };
</script>

{#snippet tabs({ params }: PanelProps<"grid", Props>)}
  <div class="w-full h-full" bind:this={params.elements.dock}>
    <DockView
      {...params}
      components={{ Editor, Preview }}
      tabs={{ components: { PreviewTab } }}
      watermark={{ component: VsCodeWatermark }}
    />
  </div>
{/snippet}
