import { reactify } from "@p-buddy/svelte-preprocess-react";
import type { Component as Svelte5Component, ComponentType, SvelteComponent } from "svelte";
import type { FunctionComponent as ReactFunctionComponent } from "react";

export const typedReactify = <Props extends Record<string, any>>(Component: Svelte5Component<Props>) =>
  reactify(Component) as ReactFunctionComponent<Props>;
