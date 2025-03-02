import { reactify, sveltify } from "@p-buddy/svelte-preprocess-react";
import type { Component as Svelte5Component, ComponentType, SvelteComponent } from "svelte";
import type { FunctionComponent as ReactFunctionComponent } from "react";

export const typedReactify = <Props extends Record<string, any>>(Component: Svelte5Component<Props>) =>
  reactify(Component) as ReactFunctionComponent<Props>;

export type Props<T> = T extends Svelte5Component<infer P> ? P : never;

export const typedSveltify = <Props extends Record<string, any>, Name extends string>(record: Record<Name, ReactFunctionComponent<Props>>) =>
  sveltify(record) as Record<Name, Svelte5Component<Props>>;
