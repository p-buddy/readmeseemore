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
    type PanelPropsByView,
    type SnippetsConstraint,
    type ModifiedProps,
    type ViewAPI,
    fillComponentMap,
    type AdditionalPaneProps,
    extractCoreOptions,
    createExtendedAPI,
  } from "./utils.svelte";

  let paneCount = 0;

  class PanePanelSection<
    T extends Component<Props, Exports, any>,
    Props extends Record<string, any>,
    Exports extends Record<string, any>,
    AdditionalParams extends Record<string, any>,
  > implements IPanePart
  {
    static Mount = new MountMechanism();
    private readonly id: string;
    private readonly svelteComponent: T;
    private readonly mountID: ReturnType<MountMechanism["id"]>;
    private readonly _element: HTMLElement;
    private readonly additionalParams?: AdditionalParams;

    private propsUpdater?: PropsUpdater<Props>;
    private instance?: ReturnType<typeof mount<Props, Exports>>;

    get element() {
      return this._element;
    }

    constructor(
      id: string,
      name: string,
      component: T,
      paneIndex: number,
      additionalParams?: AdditionalParams,
    ) {
      this.id = id;
      this.svelteComponent = component;
      this.mountID = PanePanelSection.Mount.id(paneIndex, id, name);
      this._element = document.createElement("div");
      this._element.style.height = "100%";
      this._element.style.width = "100%";
      this.additionalParams = additionalParams;
    }

    public init({
      params,
      api,
      title,
      containerApi,
    }: PanePanelComponentInitParameter): void {
      this.propsUpdater = new PropsUpdater<Props>({
        params: this.additionalParams
          ? { ...params, ...this.additionalParams }
          : params,
        api,
        title,
        containerApi,
      } as any);

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

    public update({ params }: PanelUpdateEvent) {
      if (!this.propsUpdater) return;
      this.propsUpdater.update({
        ...this.propsUpdater.props,
        params: this.additionalParams
          ? { ...params, ...this.additionalParams }
          : params,
      });
    }

    public dispose() {
      if (this.instance) unmount(this.instance);
    }
  }

  export type PanePanelProps<T extends Record<string, any>> =
    PanelPropsByView<T>["pane"];
</script>

<script
  lang="ts"
  generics="
    const Components extends ComponentsConstraint<`pane`>,
    const Snippets extends SnippetsConstraint<`pane`>,
    const Headers extends {
      components: ComponentsConstraint<`pane`>;
      snippets: SnippetsConstraint<`pane`>;
    },
  "
>
  let {
    components,
    snippets,
    headers,
    onReady,
    ...props
  }: ModifiedProps<"pane", Components, Snippets> &
    AdditionalPaneProps<Headers> = $props();

  const index = paneCount++;

  let paneView: ViewAPI<"pane", Components, Snippets>;

  const mainMap = fillComponentMap<"pane", Components, Snippets>(
    components,
    snippets,
  );

  $effect(() => {
    fillComponentMap<"pane", Components, Snippets>(
      components,
      snippets,
      mainMap,
    );
  });

  const headersMap = fillComponentMap<
    "pane",
    Headers["components"],
    Headers["snippets"]
  >(headers?.components, headers?.snippets);

  $effect(() => {
    fillComponentMap<"pane", Headers["components"], Headers["snippets"]>(
      headers?.components,
      headers?.snippets,
      headersMap,
    );
  });

  for (const key of PROPERTY_KEYS_PANEVIEW)
    $effect(() => paneView!?.updateOptions({ [key]: props[key] }));

  const frameworkOptions: PaneviewFrameworkOptions = {
    createComponent: (options) => {
      return new PanePanelSection(
        options.id,
        options.name,
        mainMap.get(options.name)!,
        index,
      );
    },
    createHeaderComponent: (options) => {
      return new PanePanelSection(
        options.id,
        options.name,
        headersMap.get(options.name)!,
        index,
        headers?.snippets
          ? options.name in headers.snippets
            ? {
                snippet: headers.snippets[options.name],
              }
            : undefined
          : undefined,
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
        snippets,
        PanePanelSection.Mount,
        index,
      ),
    );

    const { clientWidth, clientHeight } = element;
    paneView.layout(clientWidth, clientHeight);

    onReady?.({ api: paneView });
  });
</script>

<div style:height={"100%"} style:width={"100%"} bind:this={element}></div>
