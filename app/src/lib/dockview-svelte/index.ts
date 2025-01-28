import type { Component } from "svelte";
import View, { type PanelPropsByView, type ViewKey, type ViewPropsByView, type SvelteComponentsConstraint, type ReactComponentsConstraint, type SnippetsConstraint, type ComponentProps } from "./View.svelte";

export { View, type PanelPropsByView, type ViewPropsByView };

type PanelComponentsCombined<Key extends ViewKey> =
  {
    [K in keyof ReactComponentsConstraint<Key> | keyof SvelteComponentsConstraint<Key> | keyof SnippetsConstraint<Key>]:
    | ReactComponentsConstraint<Key>[keyof ReactComponentsConstraint<Key>]
    | SvelteComponentsConstraint<Key>[keyof SvelteComponentsConstraint<Key>]
    | SnippetsConstraint<Key>[keyof SnippetsConstraint<Key>]
  };

type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }

type PanelComponents<
  Key extends ViewKey,
  Components extends PanelComponentsCombined<Key>,
  Constraint extends SvelteComponentsConstraint<Key> | SnippetsConstraint<Key> | ReactComponentsConstraint<Key>
> =
  keyof OmitNever<{
    [K in keyof Components]: Components[K] extends Constraint[keyof Constraint] ? Components[K] : never
  }> extends never ? Constraint : OmitNever<{
    [K in keyof Components]: Components[K] extends Constraint[keyof Constraint] ? Components[K] : never
  }>;

export type ViewComponent<Key extends ViewKey, Components extends PanelComponentsCombined<Key>> =
  typeof View<
    Key,
    Extract<Components, ReactComponentsConstraint<Key>>,
    PanelComponents<Key, Components, SvelteComponentsConstraint<Key>>,
    PanelComponents<Key, Components, SnippetsConstraint<Key>>
  >;

export type ViewProps<Key extends ViewKey, Components extends PanelComponentsCombined<Key>> =
  ViewComponent<Key, Components> extends Component<infer P> ? P : never;

export type FromViewProps<Key extends ViewKey, Components extends PanelComponentsCombined<Key>, PickKey extends keyof ViewProps<Key, Components>> =
  Pick<ViewProps<Key, Components>, PickKey>;

export type OnViewReady<Key extends ViewKey, Components extends PanelComponentsCombined<Key>> =
  FromViewProps<Key, Components, "onReady">["onReady"];

export type WithViewOnReady<Key extends ViewKey, Components extends PanelComponentsCombined<Key>> =
  FromViewProps<Key, Components, "onReady">;

export type ViewAPI<Key extends ViewKey, Components extends PanelComponentsCombined<Key>> =
  Parameters<OnViewReady<Key, Components>>[0]["api"];
