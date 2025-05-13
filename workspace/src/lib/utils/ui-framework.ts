import type { Component as Svelte5Component } from "svelte";

export type Props<T> = T extends Svelte5Component<infer P> ? Omit<P, "$$events" | "$$slots"> : never;

export type Exports<T> = T extends Svelte5Component<infer _, infer E> ? E : never;