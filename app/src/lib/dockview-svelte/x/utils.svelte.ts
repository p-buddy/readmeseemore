import type {
  IFrameworkPart,
  DockviewApi,
  GridviewApi,
  IGridviewPanel,
  IDockviewPanel,
  IPaneviewPanel,
  ISplitviewPanel,
  SplitviewApi,
  PaneviewApi,
} from "dockview-core";
import type { Component, Snippet } from "svelte";
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
import SnippetRender from "../SnippetRender.svelte";

export type ViewPropsByView = {
  grid: IGridviewReactProps;
  dock: IDockviewReactProps;
  pane: IPaneviewReactProps;
  split: ISplitviewReactProps;
};

export type ViewKey = keyof ViewPropsByView;

export type PanelPropKeys = keyof (
  | IGridviewPanelProps
  | IDockviewPanelProps
  | IPaneviewPanelProps
  | ISplitviewPanelProps
);

export type AddedPanelByView = {
  grid: IGridviewPanel;
  dock: IDockviewPanel;
  pane: IPaneviewPanel;
  split: ISplitviewPanel;
};

type AnyComponent = Component<any, any, any>;

type ViewComponents<T extends keyof ViewPropsByView> =
  ViewPropsByView[T]["components"];

export type ComponentProps<T extends keyof ViewPropsByView> = {
  [K in keyof ViewComponents<T>]: ViewComponents<T>[K] extends React.FunctionComponent<
    infer P
  >
  ? P
  : never;
}[keyof ViewComponents<T>];

export type ComponentsConstraint<ViewType extends ViewKey> = Record<
  string,
  Component<ComponentProps<ViewType> & Record<string, any>>
>;

export type SnippetsConstraint<ViewType extends ViewKey> = Record<
  string,
  Snippet<[ComponentProps<ViewType>]>
>;

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

type ExtractPanelOptions<T extends keyof ViewPropsByView> = Parameters<
  Parameters<ViewPropsByView[T]["onReady"]>[0]["api"]["addPanel"]
>[0];

type AddPanelOptions<T extends keyof ViewPropsByView> = Omit<
  ExtractPanelOptions<T>,
  "id" | "component" | "params"
> & { id?: string };

type PropParams<ViewType extends ViewKey, K extends keyof Components, Components extends Record<string, Component<any>>> =
  Components[K] extends Component<infer Props extends PanelPropsByView[ViewType]>
  ? Props["params"]
  : never;


export type ComponentExports<K extends keyof Components, Components extends Record<string, Component<any>>> =
  Components[K] extends Component<infer _, infer Exports>
  ? Exports
  : never;

export type ExtendedContainerAPI<ViewType extends ViewKey, Components extends Record<string, Component<any>>, Snippets extends Record<string, Snippet<any[]>>> = {
  addSveltePanel: <K extends keyof Components & string>(
    name: string extends K ? never : K,
    ...params: PropParams<ViewType, K, Components> extends Record<string, any>
      ?
      | [PropParams<ViewType, K, Components>]
      | [PropParams<ViewType, K, Components>, AddPanelOptions<ViewType>]
      : [null | undefined | {}, AddPanelOptions<ViewType>] | []
  ) => Promise<ComponentExports<K, Components> & AddedPanelByView[ViewType]>;
  addSnippetPanel: <K extends keyof Snippets>(
    name: string extends K ? never : K,
    ...params: Snippets[K] extends Snippet<
      infer Params extends [PanelPropsByView[ViewType]]
    >
      ?
      | [Params[number]["params"]]
      | [Params[number]["params"], AddPanelOptions<ViewType>]
      : [null | undefined | {}, AddPanelOptions<ViewType>] | []
  ) => Promise<AddedPanelByView[ViewType]>;
};

export type ViewAPI<
  ViewType extends ViewKey,
  Components extends Record<string, Component<any>>,
  Snippets extends Record<string, Snippet<any[]>>
> = {
  grid: GridviewApi;
  dock: DockviewApi;
  pane: PaneviewApi;
  split: SplitviewApi;
}[ViewType] & ExtendedContainerAPI<ViewType, Components, Snippets>;

type RawViewProps<ViewType extends ViewKey> = ViewPropsByView[ViewType];
type OnReady<ViewType extends ViewKey> = RawViewProps<ViewType>["onReady"];

type CustomizedViewProps<ViewType extends ViewKey, Components extends Record<string, Component<any>>, Snippets extends Record<string, Snippet<any[]>>> = {
  components?: Components;
  snippets?: Snippets;
  onReady: (
    event: Parameters<OnReady<ViewType>>[0] & { api: ExtendedContainerAPI<ViewType, Components, Snippets> },
  ) => ReturnType<OnReady<ViewType>>;
};

export type ModifiedProps<ViewType extends ViewKey, Components extends Record<string, Component<any>>, Snippets extends Record<string, Snippet<any[]>>> = Omit<
  RawViewProps<ViewType>,
  keyof CustomizedViewProps<ViewType, Components, Snippets> | "components"
> &
  CustomizedViewProps<ViewType, Components, Snippets>;

export class PropsUpdater<T extends Record<string, any>> implements Pick<IFrameworkPart, "update"> {
  props = $state<T>()!;

  constructor(props: T) {
    this.props = props;
  }

  update(params: T) {
    this.props = params;
  }
}

export const extractCoreOptions = <In extends {}, Out>(props: In, propertyKeys: (keyof In | keyof Out)[]): Out =>
  propertyKeys.reduce((obj, key) => {
    if (key in props)
      obj[key as keyof Out] = props[key as keyof In] as any;
    return obj;
  }, {} as Out);

export const deferred = <T>() => {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

export class MountMechanism {
  private defferedMountMap = new Map<
    ReturnType<typeof this.id>,
    ReturnType<typeof deferred<Record<string, any>>>
  >();

  id = <
    UUID extends number,
    ID extends string,
    Component extends string,
  >(
    uuid: UUID,
    id: ID,
    component: Component,
  ): `${UUID}${ID}${Component}` => `${uuid}${id}${component}`;


  await<Exports extends Record<string, any>>(
    uuid: number,
    id: string,
    component: string,
    reset = false,
  ): Promise<Exports> {
    const mountID = this.id(uuid, id, component);
    if (this.defferedMountMap.has(mountID) && !reset)
      return this.defferedMountMap.get(mountID)!.promise as Promise<Exports>;
    const _deffered = deferred<Record<string, any>>();
    this.defferedMountMap.set(mountID, _deffered);
    return _deffered.promise as Promise<Exports>;
  }

  get<Exports extends Record<string, any>>(
    id: ReturnType<typeof this.id>
  ) {
    const stored = this.defferedMountMap.get(id);
    return stored as ReturnType<typeof deferred<Exports>> | undefined;
  }

  drop(id: ReturnType<typeof this.id>) {
    this.defferedMountMap.delete(id);
  }
}

export const fillComponentMap = <
  ViewType extends ViewKey, Components extends ComponentsConstraint<ViewType>, Snippets extends SnippetsConstraint<ViewType>
>(components: Components | undefined, snippets: Snippets | undefined, map?: Map<string, AnyComponent>) => {
  map ??= new Map<string, AnyComponent>();
  if (components)
    for (const key in components)
      map.set(key, components[key]);
  if (snippets)
    for (const key in snippets)
      map.set(key, SnippetRender);
  return map;
}