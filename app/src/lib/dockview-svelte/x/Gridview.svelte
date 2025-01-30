<script module lang="ts">
  import {
    createGridview,
    GridviewApi,
    GridviewPanel,
    PROPERTY_KEYS_GRIDVIEW,
    type GridviewInitParameters,
    type IFrameworkPart,
    type GridviewComponent,
    type GridviewFrameworkOptions,
  } from "dockview-core";
  import { mount, onMount, unmount, type Component } from "svelte";
  import {
    extractCoreOptions,
    PropsUpdater,
    type ComponentsConstraint,
    type SnippetsConstraint,
    type ModifiedProps,
    type ViewAPI,
    type PanelPropsByView,
    MountMechanism,
    fillComponentMap,
    createExtendedAPI,
  } from "./utils.svelte";

  let gridCount = 0;

  class SvelteGridPanelView<
    T extends Component<any, any, any>,
  > extends GridviewPanel {
    static Mount = new MountMechanism();
    private readonly svelteComponent: T;
    private readonly mountID: ReturnType<MountMechanism["id"]>;

    constructor(
      id: string,
      name: string,
      svelteComponent: T,
      gridIndex: number,
    ) {
      super(id, name);
      this.svelteComponent = svelteComponent;
      this.mountID = SvelteGridPanelView.Mount.id(gridIndex, id, name);
      this.element.id = "grid" + gridIndex;
    }

    getComponent(): IFrameworkPart {
      const { _params } = this;
      const updater = new PropsUpdater({
        params: _params?.params ?? {},
        api: this.api,
        containerApi: new GridviewApi(
          (_params as GridviewInitParameters).accessor as GridviewComponent,
        ),
      });

      const component = mount(this.svelteComponent, {
        target: this.element,
        props: updater.props,
      });

      SvelteGridPanelView.Mount.get(this.mountID)?.resolve(component);
      SvelteGridPanelView.Mount.drop(this.mountID);

      return {
        update: updater.update.bind(updater),
        dispose: () => unmount(component),
      };
    }
  }

  export type GridPanelProps<T extends Record<string, any>> =
    PanelPropsByView<T>["grid"];
</script>

<script
  lang="ts"
  generics="
    const Components extends ComponentsConstraint<`grid`>,
    const Snippets extends SnippetsConstraint<`grid`>,
  "
>
  let {
    components,
    snippets,
    onReady,
    ...props
  }: ModifiedProps<"grid", Components, Snippets> = $props();

  const index = gridCount++;

  let gridView: ViewAPI<"grid", Components, Snippets>;

  const map = fillComponentMap<"grid", Components, Snippets>(
    components,
    snippets,
  );

  $effect(() => {
    fillComponentMap<"grid", Components, Snippets>(components, snippets, map);
  });

  for (const key of PROPERTY_KEYS_GRIDVIEW)
    $effect(() => gridView!?.updateOptions({ [key]: props[key] }));

  const frameworkOptions: GridviewFrameworkOptions = {
    createComponent: (options) => {
      return new SvelteGridPanelView(
        options.id,
        options.name,
        map.get(options.name)!,
        index,
      );
    },
  };

  let element: HTMLElement;

  onMount(() => {
    const api = createGridview(element, {
      ...extractCoreOptions(props, PROPERTY_KEYS_GRIDVIEW),
      ...frameworkOptions,
    });
    gridView = Object.assign(
      api,
      createExtendedAPI<"grid", Components, Snippets>(
        "grid",
        api,
        snippets,
        SvelteGridPanelView.Mount,
        index,
      ),
    );

    const { clientWidth, clientHeight } = element;
    gridView.layout(clientWidth, clientHeight);

    onReady?.({ api: gridView });
  });
</script>

<div style:height={"100%"} style:width={"100%"} bind:this={element}></div>
