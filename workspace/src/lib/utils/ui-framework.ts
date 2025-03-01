import { reactify, sveltify } from "svelte-preprocess-react";
import type { Component as Svelte5Component } from "svelte";
import type { FunctionComponent as ReactFunctionComponent } from "react";

export const typedReactify = <Props extends Record<string, any>>(Component: Svelte5Component<Props>) =>
  reactify(Component) as ReactFunctionComponent<Props>;

export type Props<T> = T extends Svelte5Component<infer P> ? P : never;

