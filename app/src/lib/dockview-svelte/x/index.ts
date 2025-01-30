import type { Component } from "svelte";
import type { SnippetsConstraint, ComponentsConstraint, ViewKey } from "./utils.svelte";
import type Gridview from "./Gridview.svelte";

type PanelComponentsCombined<Key extends ViewKey> =
  {
    [K in (keyof ComponentsConstraint<Key> | keyof SnippetsConstraint<Key>)]:
    | ComponentsConstraint<Key>[keyof ComponentsConstraint<Key>]
    | SnippetsConstraint<Key>[keyof SnippetsConstraint<Key>]
  };

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }

type PanelComponents<
  Key extends ViewKey,
  Components extends PanelComponentsCombined<Key>,
  Constraint extends ComponentsConstraint<Key> | SnippetsConstraint<Key>
> =
  keyof OmitNever<{
    [K in keyof Components]: Components[K] extends Constraint[keyof Constraint] ? Components[K] : never
  }> extends never ? Constraint : OmitNever<{
    [K in keyof Components]: Components[K] extends Constraint[keyof Constraint] ? Components[K] : never
  }>;

export type GridComponentType<Components extends PanelComponentsCombined<"grid">> = Gridview<
  PanelComponents<"grid", Components, ComponentsConstraint<"grid">>,
  PanelComponents<"grid", Components, SnippetsConstraint<"grid">>,
  "grid"
>;

type SomeViewComponentType = GridComponentType<PanelComponentsCombined<"grid">>;

export type ViewProps<ComponentType extends SomeViewComponentType> =
  ComponentType extends Component<infer P> ? P : never;

export type FromViewProps<ComponentType extends SomeViewComponentType, PickKey extends keyof ViewProps<ComponentType>> =
  Pick<ViewProps<ComponentType>, PickKey>;

export type OnViewReady<ComponentType extends SomeViewComponentType> =
  FromViewProps<ComponentType, "onReady">["onReady"];

export type WithViewOnReady<ComponentType extends SomeViewComponentType> =
  FromViewProps<ComponentType, "onReady">;

export type ViewAPI<ComponentType extends SomeViewComponentType> =
  "api" extends keyof Parameters<OnViewReady<ComponentType>>[0]
  ? Parameters<OnViewReady<ComponentType>>[0]["api"]
  : never;
