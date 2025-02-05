<script module lang="ts">
  import {
    type PanelUpdateEvent,
    type IPanePart,
    type PanePanelComponentInitParameter,
    PROPERTY_KEYS_PANEVIEW,
    type PaneviewFrameworkOptions,
    createPaneview,
  } from "dockview-core";
  import { type Component, mount, onMount, unmount } from "svelte";
  import {
    MountMechanism,
    PropsUpdater,
    type ComponentsConstraint,
    type SelectivelyRequiredPanelComponentPropsByView,
    type SnippetsConstraint,
    type ModifiedProps,
    type ViewAPI,
    type AdditionalPaneProps,
    extractCoreOptions,
    createExtendedAPI,
    getComponentToMount,
    type PanelComponentProps,
    type PropsPostProcessor,
  } from "./utils.svelte";

  let paneCount = 0;

  type PanelProps = PanelComponentProps<"pane">;

  class PanePanelSection<
    T extends Component<PanelProps, Exports, any>,
    Exports extends Record<string, any>,
  > implements IPanePart
  {
    static Mount = new MountMechanism();
    private readonly id: string;
    private readonly svelteComponent: T;
    private readonly mountID: ReturnType<MountMechanism["id"]>;
    private readonly _element: HTMLElement;
    private readonly propsPostProcessor?: PropsPostProcessor<PanelProps>;

    private propsUpdater?: PropsUpdater<PanelProps>;
    private instance?: ReturnType<typeof mount<PanelProps, Exports>>;

    get element() {
      return this._element;
    }

    constructor(
      id: string,
      name: string,
      component: T,
      paneIndex: number,
      propsPostProcessor?: PropsPostProcessor<PanelProps>,
    ) {
      this.id = id;
      this.svelteComponent = component;
      this.mountID = PanePanelSection.Mount.id(paneIndex, id, name);
      this._element = document.createElement("div");
      this._element.style.height = "100%";
      this._element.style.width = "100%";
      this.propsPostProcessor = propsPostProcessor;
    }

    public init({
      params,
      api,
      title,
      containerApi,
    }: PanePanelComponentInitParameter): void {
      this.propsUpdater = new PropsUpdater<PanelProps>(
        {
          params,
          api,
          title,
          containerApi,
        },
        this.propsPostProcessor,
      );

      this.instance = mount(this.svelteComponent, {
        target: this.element,
        props: this.propsUpdater!.props,
      });

      PanePanelSection.Mount.get(this.mountID)?.resolve(this.instance);
      PanePanelSection.Mount.drop(this.mountID);
    }

    public toJSON() {
      return {
        id: this.id,
      };
    }

    public update({ params }: { params: any }) {
      if (!this.propsUpdater) return;
      this.propsUpdater.updateSingle("params", params);
    }

    public dispose() {
      if (this.instance) unmount(this.instance);
    }
  }

  export type PanePanelProps<T extends Record<string, any>> =
    SelectivelyRequiredPanelComponentPropsByView<T>["pane"];
</script>

<script
  lang="ts"
  generics="
    const Components extends ComponentsConstraint<`pane`>,
    const Snippets extends SnippetsConstraint<`pane`>,
    const HeaderComponents extends ComponentsConstraint<`pane`>,
    const HeaderSnippets extends SnippetsConstraint<`pane`>,
  "
>
  type Headers = {
    components: HeaderComponents;
    snippets: HeaderSnippets;
  };

  type Props = AdditionalPaneProps<Headers> &
    ModifiedProps<"pane", Components, Snippets, { headers: Headers }>;

  let { components, snippets, headers, onReady, onDidDrop, ...props }: Props =
    $props();

  const index = paneCount++;

  let paneView: ViewAPI<"pane", Components, Snippets>;

  for (const key of PROPERTY_KEYS_PANEVIEW)
    $effect(() => paneView!?.updateOptions({ [key]: props[key] }));

  const frameworkOptions: PaneviewFrameworkOptions = {
    createComponent: (options) => {
      const { component, propsPostProcessor, name } = getComponentToMount(
        "pane",
        components,
        snippets,
        options,
      );

      return new PanePanelSection(
        options.id,
        name,
        component,
        index,
        propsPostProcessor,
      );
    },
    createHeaderComponent: (options) => {
      const { component, propsPostProcessor, name } = getComponentToMount(
        "pane",
        headers?.components,
        headers?.snippets,
        options,
      );

      return new PanePanelSection(
        options.id,
        name,
        component!,
        index,
        propsPostProcessor,
      );
    },
  };

  let element: HTMLElement;

  onMount(() => {
    const api = createPaneview(element, {
      ...extractCoreOptions(props, PROPERTY_KEYS_PANEVIEW),
      ...frameworkOptions,
    });

    paneView = Object.assign(
      api,
      createExtendedAPI<"pane", Components, Snippets>(
        "pane",
        api,
        PanePanelSection.Mount,
        index,
      ),
    );

    const { clientWidth, clientHeight } = element;
    paneView.layout(clientWidth, clientHeight);

    onReady?.({ api: paneView });
  });

  $effect(() => {
    if (onDidDrop) paneView?.onDidDrop(onDidDrop);
  });
</script>

<div style:height={"100%"} style:width={"100%"} bind:this={element}></div>
