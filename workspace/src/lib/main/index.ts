import type { OperatingSystem } from "$lib/operating-system/index.js";

export type ElementKey = "dock" | "tree" | "terminals";

export type Elements = Partial<Record<ElementKey, HTMLElement | undefined>>;

export type WithElements<PickKeys extends ElementKey = ElementKey> =
  { elements: Pick<Elements, PickKeys> };

export type OS = OperatingSystem;

export type WithOperatingSystem<T = {}> = T & { os: OS };

export { default as Grid, type Props as GridProps } from "./Grid.svelte";
export { default as Toolbar } from "./Toolbar.svelte";
