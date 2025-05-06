import type { OperatingSystem } from "$lib/operating-system/index.js";

export type ElementKey = "dock" | "tree" | "terminals";

export type Elements = Partial<Record<ElementKey, HTMLElement | undefined>>;

export type WithElements<T = {}> = T & { elements: Elements };

export type OS = OperatingSystem;

export type WithOperatingSystem<T = {}> = T & { os: OS };

export { default as Grid, type Props as GridProps } from "./Grid.svelte";
export { default as Toolbar } from "./Toolbar.svelte";
