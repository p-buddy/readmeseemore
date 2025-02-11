<script lang="ts" module>
  import type { Component } from "svelte";
  import type {
    ComponentsConstraint,
    DockviewSpecificComponentConstraint,
    DockviewTabConstraint,
    SnippetsConstraint,
    ViewKey,
  } from "../utils.svelte";
  import GridView from "../GridView.svelte";
  import SplitView from "../SplitView.svelte";
  import PaneView from "../PaneView.svelte";
  import DockView from "../DockView.svelte";

  type ExtractProps<T> = T extends Component<infer Props> ? Props : never;

  type ViewProps<
    ViewType extends ViewKey,
    Components extends ComponentsConstraint<ViewType>,
    Snippets extends SnippetsConstraint<ViewType>,
    Constraint3 extends ViewType extends "pane"
      ? ComponentsConstraint<"pane">
      : DockviewTabConstraint["components"] = never,
    Constraint4 extends ViewType extends "pane"
      ? SnippetsConstraint<"pane">
      : DockviewTabConstraint["snippets"] = never,
    Watermark extends DockviewSpecificComponentConstraint[`watermark`] = never,
    DefaultTab extends
      DockviewSpecificComponentConstraint[`defaultTab`] = never,
    RightHeaderActions extends
      DockviewSpecificComponentConstraint[`rightHeaderActions`] = never,
    LeftHeaderActions extends
      DockviewSpecificComponentConstraint[`leftHeaderActions`] = never,
    PrefixHeaderActions extends
      DockviewSpecificComponentConstraint[`prefixHeaderActions`] = never,
  > = ViewType extends "grid"
    ? Components extends ComponentsConstraint<"grid">
      ? Snippets extends SnippetsConstraint<"grid">
        ? ExtractProps<GridView<Components, Snippets>>
        : never
      : never
    : ViewType extends "split"
      ? Components extends ComponentsConstraint<"split">
        ? Snippets extends SnippetsConstraint<"split">
          ? ExtractProps<SplitView<Components, Snippets>>
          : never
        : never
      : ViewType extends "pane"
        ? Components extends ComponentsConstraint<"pane">
          ? Snippets extends SnippetsConstraint<"pane">
            ? Constraint3 extends ComponentsConstraint<"pane">
              ? Constraint4 extends SnippetsConstraint<"pane">
                ? ExtractProps<
                    PaneView<Components, Snippets, Constraint3, Constraint4>
                  >
                : never
              : never
            : never
          : never
        : ViewType extends "dock"
          ? Components extends ComponentsConstraint<"dock">
            ? Snippets extends SnippetsConstraint<"dock">
              ? Constraint3 extends DockviewTabConstraint["components"]
                ? Constraint4 extends DockviewTabConstraint["snippets"]
                  ? ExtractProps<
                      DockView<
                        Components,
                        Snippets,
                        Constraint3,
                        Constraint4,
                        Watermark,
                        DefaultTab,
                        RightHeaderActions,
                        LeftHeaderActions,
                        PrefixHeaderActions
                      >
                    >
                  : never
                : never
              : never
            : never
          : never;
</script>

<script
  lang="ts"
  generics="
  ViewType extends ViewKey,
  Components extends ComponentsConstraint<ViewType>,
  Snippets extends SnippetsConstraint<ViewType>,
  Constraint3 extends ViewType extends `pane`
    ? ComponentsConstraint<`pane`>
    : DockviewTabConstraint[`components`] = never,
  Constraint4 extends ViewType extends `pane`
    ? SnippetsConstraint<`pane`>
    : DockviewTabConstraint[`snippets`] = never,
  Watermark extends DockviewSpecificComponentConstraint[`watermark`] = never,
  DefaultTab extends
    DockviewSpecificComponentConstraint[`defaultTab`] = never,
  RightHeaderActions extends
    DockviewSpecificComponentConstraint[`rightHeaderActions`] = never,
  LeftHeaderActions extends
    DockviewSpecificComponentConstraint[`leftHeaderActions`] = never,
  PrefixHeaderActions extends
    DockviewSpecificComponentConstraint[`prefixHeaderActions`] = never,
"
>
  let props: ViewProps<
    ViewType,
    Components,
    Snippets,
    Constraint3,
    Constraint4,
    Watermark,
    DefaultTab,
    RightHeaderActions,
    LeftHeaderActions,
    PrefixHeaderActions
  > & { type: ViewType } = $props();
</script>
