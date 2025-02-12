<script lang="ts" module>
  import {
    createDockview,
    DockviewApi,
    DockviewCompositeDisposable,
    DockviewEmitter,
    DockviewEvent,
    DockviewGroupPanel,
    DockviewMutableDisposable,
    PROPERTY_KEYS_DOCKVIEW,
    type DockviewFrameworkOptions,
    type DockviewGroupPanelApi,
    type GroupPanelPartInitParameters,
    type IContentRenderer,
    type IDockviewHeaderActionsProps,
    type IDockviewPanelProps,
    type IGroupPanelBaseProps,
    type IHeaderActionsRenderer,
    type ITabRenderer,
    type IWatermarkPanelProps,
    type IWatermarkRenderer,
    type WatermarkRendererInitParameters,
  } from "dockview-core";
  import type {
    ComponentsConstraint,
    DockviewSpecificComponentConstraint,
    DockviewTabConstraint,
    ModifiedProps,
    RecursivePartial,
    SnippetsConstraint,
    PropsPostProcessor,
    ViewAPI,
  } from "./utils.svelte";
  import {
    createExtendedAPI,
    extractCoreOptions,
    getComponentToMount,
    MountMechanism,
    PanelRendererBase,
  } from "./utils.svelte";
  import { onMount, type Component } from "svelte";
  import SnippetRender from "./SnippetRender.svelte";

  let dockCount = 0;

  class SvelteContentRenderer<T extends Component<IDockviewPanelProps>>
    extends PanelRendererBase<IDockviewPanelProps, GroupPanelPartInitParameters>
    implements IContentRenderer
  {
    static Mount = new MountMechanism();
    private readonly mountID: ReturnType<MountMechanism["id"]>;

    private readonly _onDidFocus = new DockviewEmitter<void>();
    readonly onDidFocus: DockviewEvent<void> = this._onDidFocus.event;

    private readonly _onDidBlur = new DockviewEmitter<void>();
    readonly onDidBlur: DockviewEvent<void> = this._onDidBlur.event;

    constructor(
      id: string,
      name: string,
      svelteComponent: T,
      index: number,
      propsPostProcessor?: PropsPostProcessor<IDockviewPanelProps>,
    ) {
      super(
        ({ params, api, containerApi }) => ({
          params,
          api,
          containerApi,
        }),
        true,
        svelteComponent,
        propsPostProcessor,
      );
      this.mountID = SvelteContentRenderer.Mount.id(index, id, name);
    }

    public init(parameters: GroupPanelPartInitParameters) {
      super.init(parameters);
      SvelteContentRenderer.Mount.tryResolveAndDrop(
        this.mountID,
        this.instance,
      );
    }

    public dispose(): void {
      super.dispose();
      this._onDidFocus.dispose();
      this._onDidBlur.dispose();
    }
  }

  class SvelteHeaderRenderer<T extends Component<IGroupPanelBaseProps>>
    extends PanelRendererBase<
      IGroupPanelBaseProps,
      GroupPanelPartInitParameters
    >
    implements ITabRenderer
  {
    constructor(
      svelteComponent: T,
      propsPostProcessor?: PropsPostProcessor<IGroupPanelBaseProps>,
    ) {
      super(
        ({ params, api, containerApi }) => ({
          params,
          api,
          containerApi,
        }),
        true,
        svelteComponent,
        propsPostProcessor,
      );
    }
  }

  class SvelteWatermarkRenderer<T extends Component<IWatermarkPanelProps>>
    extends PanelRendererBase<
      IWatermarkPanelProps,
      WatermarkRendererInitParameters
    >
    implements IWatermarkRenderer
  {
    constructor(
      svelteComponent: T,
      propsPostProcessor?: PropsPostProcessor<IWatermarkPanelProps>,
    ) {
      super(
        ({ group, containerApi }) => ({ group, containerApi }),
        false,
        svelteComponent,
        propsPostProcessor,
      );
    }
  }

  type ActionsHeaderInitParameters = {
    containerApi: DockviewApi;
    api: DockviewGroupPanelApi;
  };

  class SvelteActionsHeaderRenderer<
      T extends Component<IDockviewHeaderActionsProps>,
    >
    extends PanelRendererBase<
      IDockviewHeaderActionsProps,
      ActionsHeaderInitParameters
    >
    implements IHeaderActionsRenderer
  {
    private readonly mutableDisposable = new DockviewMutableDisposable();
    private readonly _group: DockviewGroupPanel;

    constructor(
      svelteComponent: T,
      group: DockviewGroupPanel,
      propsPostProcessor?: PropsPostProcessor<IDockviewHeaderActionsProps>,
    ) {
      super(
        ({ api, containerApi }) => ({
          api,
          containerApi,
          group,
          panels: group.model.panels,
          activePanel: group.model.activePanel,
          isGroupActive: group.api.isActive,
        }),
        false,
        svelteComponent,
        propsPostProcessor,
      );
      this._group = group;
    }

    init(parameters: {
      containerApi: DockviewApi;
      api: DockviewGroupPanelApi;
    }): void {
      const { _group } = this;

      this.mutableDisposable.value = new DockviewCompositeDisposable(
        _group.model.onDidAddPanel(() => this.updatePanels()),
        _group.model.onDidRemovePanel(() => this.updatePanels()),
        _group.model.onDidActivePanelChange(() => this.updateActivePanel()),
        parameters.api.onDidActiveChange(() => this.updateGroupActive()),
      );

      super.init(parameters);
    }

    dispose(): void {
      super.dispose();
      this.mutableDisposable.dispose();
    }

    private updatePanels(): void {
      this.propsUpdater?.updateSingle("panels", this._group.model.panels);
    }

    private updateActivePanel(): void {
      this.propsUpdater?.updateSingle(
        "activePanel",
        this._group.model.activePanel,
      );
    }

    private updateGroupActive(): void {
      this.propsUpdater?.updateSingle(
        "isGroupActive",
        this._group.api.isActive,
      );
    }
  }

  type GroupControlElementKey =
    | "leftHeaderActions"
    | "rightHeaderActions"
    | "prefixHeaderActions";

  type CreateGroupControlElement =
    | ((groupPanel: DockviewGroupPanel) => IHeaderActionsRenderer)
    | undefined;

  const createGroupControlElement = <Type extends GroupControlElementKey>(
    detail?: DockviewSpecificComponentConstraint[Type],
  ): CreateGroupControlElement =>
    detail
      ? (groupPanel: DockviewGroupPanel) => {
          if ("component" in detail)
            return new SvelteActionsHeaderRenderer(
              detail.component,
              groupPanel,
            );

          if ("snippet" in detail)
            return new SvelteActionsHeaderRenderer(
              SnippetRender as any,
              groupPanel,
              (props: any) => (props.snippet = detail.snippet),
            );

          throw new Error("Invalid component and/or snippet");
        }
      : undefined;
</script>

<script
  lang="ts"
  generics="
  const Components extends ComponentsConstraint<`dock`>,
  const Snippets extends SnippetsConstraint<`dock`>,
  const TabComponent extends DockviewTabConstraint[`components`],
  const TabSnippet extends DockviewTabConstraint[`snippets`],
  const Watermark extends DockviewSpecificComponentConstraint[`watermark`],
  const DefaultTab extends DockviewSpecificComponentConstraint[`defaultTab`],
  const RightHeaderActions extends DockviewSpecificComponentConstraint[`rightHeaderActions`],
  const LeftHeaderActions extends DockviewSpecificComponentConstraint[`leftHeaderActions`],
  const PrefixHeaderActions extends DockviewSpecificComponentConstraint[`prefixHeaderActions`],
"
>
  import ViewContainer from "./ViewContainer.svelte";

  type DockSpecific = {
    tabs: {
      components: TabComponent;
      snippets: TabSnippet;
    };
    watermark: Watermark;
    defaultTab: DefaultTab;
    rightHeaderActions: RightHeaderActions;
    leftHeaderActions: LeftHeaderActions;
    prefixHeaderActions: PrefixHeaderActions;
  };

  type Props = RecursivePartial<DockSpecific> &
    ModifiedProps<"dock", Components, Snippets, DockSpecific>;

  const index = dockCount++;

  let {
    components,
    snippets,
    tabs,
    watermark,
    defaultTab,
    rightHeaderActions,
    leftHeaderActions,
    prefixHeaderActions,
    onReady,
    onDidDrop,
    onWillDrop,
    ...props
  }: Props = $props();

  let dockView: ViewAPI<"dock", Components, Snippets>;

  for (const key of PROPERTY_KEYS_DOCKVIEW)
    $effect(() => dockView!?.updateOptions({ [key]: props[key] }));

  const frameworkOptions: DockviewFrameworkOptions = {
    createLeftHeaderActionComponent: createGroupControlElement(
      leftHeaderActions as LeftHeaderActions,
    ),
    createRightHeaderActionComponent: createGroupControlElement(
      rightHeaderActions as RightHeaderActions,
    ),
    createPrefixHeaderActionComponent: createGroupControlElement(
      prefixHeaderActions as PrefixHeaderActions,
    ),
    createComponent: (options) => {
      console.log("createComponent", options.id);
      const { component, propsPostProcessor, name } = getComponentToMount(
        "dock",
        components,
        snippets,
        options,
      );

      return new SvelteContentRenderer(
        options.id,
        name,
        component,
        index,
        propsPostProcessor,
      );
    },
    createTabComponent: tabs
      ? (options) => {
          const { component, propsPostProcessor, name } = getComponentToMount(
            "dock",
            tabs.components as ComponentsConstraint<"dock">,
            tabs.snippets as SnippetsConstraint<"dock">,
            options,
          );

          return new SvelteHeaderRenderer(component!, propsPostProcessor);
        }
      : undefined,
    createWatermarkComponent: watermark
      ? () => {
          if ("component" in watermark)
            return new SvelteWatermarkRenderer(watermark.component);

          if ("snippet" in watermark)
            return new SvelteWatermarkRenderer(
              SnippetRender as any,
              (props: any) => (props.snippet = watermark.snippet),
            );

          throw new Error("Invalid watermark component and/or snippet");
        }
      : undefined,
  };

  let element = $state<HTMLElement>();

  onMount(() => {
    const api = createDockview(element!, {
      ...extractCoreOptions(props, PROPERTY_KEYS_DOCKVIEW),
      ...frameworkOptions,
    });

    dockView = Object.assign(
      api,
      createExtendedAPI<"dock", Components, Snippets>(
        "dock",
        api,
        SvelteContentRenderer.Mount,
        index,
      ),
    );

    const { clientWidth, clientHeight } = element!;
    dockView.layout(clientWidth, clientHeight);

    onReady?.({ api: dockView });
  });

  $effect(() => {
    if (onDidDrop) dockView?.onDidDrop(onDidDrop);
  });

  $effect(() => {
    if (onWillDrop) dockView?.onWillDrop(onWillDrop);
  });
</script>

<ViewContainer id={`dock${index}`} bind:element />
