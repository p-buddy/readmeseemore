<script lang="ts" module>
  import type {
    IPaneviewReactProps,
    IDockviewReactProps,
    IGridviewReactProps,
    ISplitviewReactProps,
    IGridviewPanelProps,
    IDockviewPanelProps,
    IPaneviewPanelProps,
    ISplitviewPanelProps,
    IGridviewPanel,
    IDockviewPanel,
    IPaneviewPanel,
    ISplitviewPanel,
  } from "dockview";
  import type React from "react";
  import type { Snippet, Component as SvelteComponent } from "svelte";

  export type ViewPropsByView = {
    grid: IGridviewReactProps;
    dock: IDockviewReactProps;
    pane: IPaneviewReactProps;
    split: ISplitviewReactProps;
  };

  export type ViewKey = keyof ViewPropsByView;

  type PanelPropKeys = keyof (
    | IGridviewPanelProps
    | IDockviewPanelProps
    | IPaneviewPanelProps
    | ISplitviewPanelProps
  );

  type AddedPanelByView = {
    grid: IGridviewPanel;
    dock: IDockviewPanel;
    pane: IPaneviewPanel;
    split: ISplitviewPanel;
  };

  type RequiredAndPartial<T, Required extends keyof T> = Pick<T, Required> &
    Partial<Omit<T, Required>>;

  export type PanelPropsByView<
    T extends { [index: string]: any } = any,
    Required extends PanelPropKeys = "params",
  > = {
    grid: RequiredAndPartial<IGridviewPanelProps<T>, Required>;
    dock: RequiredAndPartial<IDockviewPanelProps<T>, Required>;
    pane: RequiredAndPartial<IPaneviewPanelProps<T>, Required>;
    split: RequiredAndPartial<ISplitviewPanelProps<T>, Required>;
  };

  type ViewComponents<T extends keyof ViewPropsByView> =
    ViewPropsByView[T]["components"];

  export type ComponentProps<T extends keyof ViewPropsByView> = {
    [K in keyof ViewComponents<T>]: ViewComponents<T>[K] extends React.FunctionComponent<
      infer P
    >
      ? P
      : never;
  }[keyof ViewComponents<T>];

  type ExtractPanelOptions<T extends keyof ViewPropsByView> = Parameters<
    Parameters<ViewPropsByView[T]["onReady"]>[0]["api"]["addPanel"]
  >[0];

  type AddPanelOptions<T extends keyof ViewPropsByView> = Omit<
    ExtractPanelOptions<T>,
    "id" | "component" | "params"
  > & { id?: string };

  type OnMount = {
    onSvelteMount: (exports: any) => void;
  };

  const mountKey = "params.onSvelteMount" satisfies `params.${keyof OnMount}`;

  const reactfiedSnippetRender = reactify(
    SnippetRender,
    mountKey,
  ) as ReturnType<typeof reactify>;

  export type ReactComponentsConstraint<ViewType extends ViewKey> =
    ViewComponents<ViewType>;

  export type SvelteComponentsConstraint<ViewType extends ViewKey> = Record<
    string,
    SvelteComponent<ComponentProps<ViewType> & Record<string, any>>
  >;

  export type SnippetsConstraint<ViewType extends ViewKey> = Record<
    string,
    Snippet<[ComponentProps<ViewType>]>
  >;
</script>

<script
  lang="ts"
  generics="
    ViewType extends ViewKey, 
    const ReactComponents extends ReactComponentsConstraint<ViewType>,
    const SvelteComponents extends SvelteComponentsConstraint<ViewType>,
    const Snippets extends SnippetsConstraint<ViewType>,
  "
>
  import { reactify, sveltify } from "@p-buddy/svelte-preprocess-react";
  import SnippetRender from "./SnippetRender.svelte";
  import wrapper from "./wrapper";

  type RawViewProps = ViewPropsByView[ViewType];
  type PanelProps = PanelPropsByView[ViewType];
  type Panel = AddedPanelByView[ViewType];
  type OnReady = RawViewProps["onReady"];

  type SpecificSvelteProps<K extends keyof SvelteComponents> =
    SvelteComponents[K] extends SvelteComponent<infer Props extends PanelProps>
      ? Props["params"]
      : never;

  type SvelteExports<K extends keyof SvelteComponents> =
    SvelteComponents[K] extends SvelteComponent<infer _, infer Exports>
      ? Exports
      : never;

  type ExtendedContainerAPI = {
    api: {
      addSveltePanel: <K extends keyof SvelteComponents & string>(
        name: string extends K ? never : K,
        ...params: SpecificSvelteProps<K> extends Record<string, any>
          ?
              | [SpecificSvelteProps<K>]
              | [SpecificSvelteProps<K>, AddPanelOptions<ViewType>]
          : [null | undefined | {}, AddPanelOptions<ViewType>] | []
      ) => Promise<SvelteExports<K> & AddedPanelByView[ViewType]>;
      addSnippetPanel: <K extends keyof Snippets>(
        name: string extends K ? never : K,
        ...params: Snippets[K] extends Snippet<
          infer Params extends [PanelProps]
        >
          ?
              | [Params[number]["params"]]
              | [Params[number]["params"], AddPanelOptions<ViewType>]
          : [null | undefined | {}, AddPanelOptions<ViewType>] | []
      ) => Promise<AddedPanelByView[ViewType]>;
    };
  };

  type CustomizedViewProps = {
    type: ViewType;
    svelte?: SvelteComponents;
    react?: ReactComponents;
    snippets?: Snippets;
    onReady: (
      event: Parameters<OnReady>[0] & ExtendedContainerAPI,
    ) => ReturnType<OnReady>;
  };

  type ModifiedProps = Omit<
    RawViewProps,
    keyof CustomizedViewProps | "components"
  > &
    CustomizedViewProps;

  const { type, onReady, svelte, react, snippets, ...props }: ModifiedProps =
    $props();

  const wrapped = sveltify({ component: wrapper });

  const _onReady = (event: Parameters<OnReady>[0]) => {
    const extended = event as Parameters<OnReady>[0] & ExtendedContainerAPI;
    extended.api.addSveltePanel = async (name, ...params) => {
      const { length } = params;
      const _props = length >= 1 ? params[0] : null;
      const config = length === 2 ? params[1] : null;
      let panel: Panel;
      const exports: SvelteExports<typeof name> = await new Promise(
        (resolve) =>
          (panel = event.api.addPanel({
            ...(config ?? {}),
            component: name,
            id: length === 2 ? (config?.id ?? name) : name,
            title:
              type === "pane"
                ? ((config as AddPanelOptions<"pane">)?.title ?? name)
                : (undefined as any),
            params: {
              ...(_props ?? {}),
              onSvelteMount: resolve,
            } satisfies OnMount,
            //renderer: "always",
          }) as Panel),
      );
      if (!panel!) throw new Error("Panel not found");
      return Object.assign(exports, panel);
    };
    extended.api.addSnippetPanel = (name, ...params) => {
      if (params.length === 0) (params as any[]).push({});
      params[0] = {
        ...(params[0] ?? {}),
        snippet: snippets?.[name],
      };
      return extended.api.addSveltePanel(name as never, ...(params as any));
    };
    return onReady?.(extended);
  };

  const components = Object.fromEntries([
    ...(react ? Object.entries(react) : []),
    ...(svelte
      ? Object.entries(svelte).map(
          ([key, svelte]) =>
            [
              key,
              reactify(svelte, mountKey) as ReturnType<typeof reactify>,
            ] as const,
        )
      : []),
    ...(snippets
      ? Object.keys(snippets).map(
          (key) => [key, reactfiedSnippetRender] as const,
        )
      : []),
  ]);

  console.log(type);
</script>

<wrapped.component {type} {components} onReady={_onReady} />
