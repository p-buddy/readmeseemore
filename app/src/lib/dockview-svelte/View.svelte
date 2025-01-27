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
  } from "dockview";
  import type React from "react";
  import type { Snippet, Component as SvelteComponent } from "svelte";

  export type ViewPropsByView = {
    grid: IGridviewReactProps;
    dock: IDockviewReactProps;
    pane: IPaneviewReactProps;
    split: ISplitviewReactProps;
  };
  type PanelPropKeys = keyof (
    | IGridviewPanelProps
    | IDockviewPanelProps
    | IPaneviewPanelProps
    | ISplitviewPanelProps
  );

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

  type ComponentProps<T extends keyof ViewPropsByView> = {
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
</script>

<script
  lang="ts"
  generics="
    ViewType extends keyof ViewPropsByView, 
    const ReactComponents extends ViewComponents<ViewType>,
    const SvelteComponents extends Record<string, SvelteComponent<AllowedSvelteComponentProps>>,
    const Snippets extends Record<string, Snippet<[ComponentProps<ViewType>]>>,
    AllowedSvelteComponentProps extends ComponentProps<ViewType> & Record<string, any>,
  "
>
  import { reactify } from "@p-buddy/svelte-preprocess-react";
  import Wrapper from "./Wrapper.svelte";
  import SnippetRender from "./SnippetRender.svelte";

  type RawViewProps = ViewPropsByView[ViewType];
  type PanelProps = PanelPropsByView[ViewType];
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
        name: K,
        ...params: SpecificSvelteProps<K> extends Record<string, any>
          ?
              | [SpecificSvelteProps<K>]
              | [SpecificSvelteProps<K>, AddPanelOptions<ViewType>]
          : [null | undefined | {}, AddPanelOptions<ViewType>] | []
      ) => Promise<SvelteExports<K>>;
      addSnippetPanel: <K extends keyof Snippets>(
        name: K,
        ...params: Snippets[K] extends Snippet<
          infer Params extends [PanelProps]
        >
          ?
              | [Params[number]["params"]]
              | [Params[number]["params"], AddPanelOptions<ViewType>]
          : [null | undefined | {}, AddPanelOptions<ViewType>] | []
      ) => Promise<void>;
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
</script>

<Wrapper
  {type}
  {...props}
  onReady={(event: Parameters<OnReady>[0]) => {
    const extended = event as Parameters<OnReady>[0] & ExtendedContainerAPI;
    extended.api.addSveltePanel = (name, ...params) => {
      const { length } = params;
      const _props = length >= 1 ? params[0] : null;
      const config = length === 2 ? params[1] : null;

      return new Promise((resolve) => {
        event.api.addPanel({
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
        });
      });
    };
    extended.api.addSnippetPanel = async (name, ...params) => {
      if (params.length === 0) (params as any[]).push({});
      params[0] = {
        ...(params[0] ?? {}),
        snippet: snippets?.[name],
      };
      await extended.api.addSveltePanel(name as any, ...(params as any));
    };
    return onReady?.(extended);
  }}
  components={Object.fromEntries(
    new Map<string, React.FunctionComponent>([
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
    ]),
  )}
/>
