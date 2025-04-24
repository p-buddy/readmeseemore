import type { Component as Svelte5Component } from "svelte";

export type Props<T> = T extends Svelte5Component<infer P> ? P : never;