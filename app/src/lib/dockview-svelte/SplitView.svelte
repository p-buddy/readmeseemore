<script lang="ts" module>
  import {
    SplitviewApi,
    type PanelViewInitParameters,
    SplitviewPanel,
    type IFrameworkPart,
    PROPERTY_KEYS_SPLITVIEW,
    type SplitviewFrameworkOptions,
    createSplitview,
  } from "dockview-core";
  import {
    MountMechanism,
    PropsUpdater,
    type ComponentsConstraint,
    type PropsPostProcessor,
    type SnippetsConstraint,
    type ModifiedProps,
    type ViewAPI,
    getComponentToMount,
    extractCoreOptions,
    createExtendedAPI,
  } from "./utils.svelte";
  import { mount, onMount, unmount, type Component } from "svelte";

  let splitCount = 0;

  export class SvelteSplitView<
    T extends Component<Props, any, any>,
    Props extends Record<string, any>,
  > extends SplitviewPanel {
    static Mount = new MountMechanism();
    private readonly svelteComponent: T;
    private readonly mountID: ReturnType<MountMechanism["id"]>;
    private readonly propsPostProcessor?: PropsPostProcessor<Props>;

    constructor(
      id: string,
      name: string,
      svelteComponent: T,
      gridIndex: number,
      propsPostProcessor?: PropsPostProcessor<Props>,
    ) {
      super(id, name);
      this.svelteComponent = svelteComponent;
      this.mountID = SvelteSplitView.Mount.id(gridIndex, id, name);
      this.propsPostProcessor = propsPostProcessor;
      this.element.id = `grid${gridIndex}-${id}`;
    }

    getComponent(): IFrameworkPart {
      const { _params } = this;
      const updater = new PropsUpdater(
        {
          params: _params?.params ?? {},
          api: this.api,
          containerApi: new SplitviewApi(
            (this._params as PanelViewInitParameters).accessor,
          ),
        } as any as Props,
        this.propsPostProcessor,
      );

      const component = mount(this.svelteComponent, {
        target: this.element,
        props: updater.props,
      });

      SvelteSplitView.Mount.get(this.mountID)?.resolve(component);
      SvelteSplitView.Mount.drop(this.mountID);

      return {
        update: updater.update.bind(updater),
        dispose: () => unmount(component),
      };
    }
  }
</script>

<script
  lang="ts"
  generics="
    const Components extends ComponentsConstraint<`split`>,
    const Snippets extends SnippetsConstraint<`split`>,
  "
>
  import ViewContainer from "./ViewContainer.svelte";

  let {
    components,
    snippets,
    onReady,
    ...props
  }: ModifiedProps<"split", Components, Snippets> = $props();

  const index = splitCount++;

  let splitView: ViewAPI<"split", Components, Snippets>;

  for (const key of PROPERTY_KEYS_SPLITVIEW)
    $effect(() => splitView!?.updateOptions({ [key]: props[key] }));

  const frameworkOptions: SplitviewFrameworkOptions = {
    createComponent: (options) => {
      const { component, propsPostProcessor, name } = getComponentToMount(
        "split",
        components,
        snippets,
        options,
      );
      return new SvelteSplitView(
        options.id,
        name,
        component,
        index,
        propsPostProcessor,
      );
    },
  };

  let element = $state<HTMLElement>();

  onMount(() => {
    const api = createSplitview(element!, {
      ...extractCoreOptions(props, PROPERTY_KEYS_SPLITVIEW),
      ...frameworkOptions,
    });
    splitView = Object.assign(
      api,
      createExtendedAPI<"split", Components, Snippets>(
        "split",
        api,
        SvelteSplitView.Mount,
        index,
      ),
    );

    const { clientWidth, clientHeight } = element!;
    splitView.layout(clientWidth, clientHeight);

    onReady?.({ api: splitView });
  });
</script>

<ViewContainer id={`split${index}`} bind:element />
