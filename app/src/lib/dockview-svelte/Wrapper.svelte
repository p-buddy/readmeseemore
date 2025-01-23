<script lang="ts" module>
  import { sveltify } from "@p-buddy/svelte-preprocess-react";
  import {
    DockviewReact,
    GridviewReact,
    PaneviewReact,
    SplitviewReact,
  } from "dockview";

  type Component =
    | typeof DockviewReact
    | typeof GridviewReact
    | typeof PaneviewReact
    | typeof SplitviewReact;

  const toSvelte = (component: Component) => sveltify({ component });

  const sveltified = {
    grid: toSvelte(GridviewReact),
    pane: toSvelte(PaneviewReact),
    split: toSvelte(SplitviewReact),
    dock: toSvelte(DockviewReact),
  };
  type Key = keyof typeof sveltified;
</script>

<script lang="ts" generics="T extends Key">
  import type { ViewPropsByView } from "./View.svelte";

  let { type, ...props }: { type: T } & ViewPropsByView[T] = $props();

  const react = sveltified[type];
</script>

<react.component {...props as any} />
