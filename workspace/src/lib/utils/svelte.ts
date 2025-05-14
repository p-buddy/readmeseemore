import { type Component as Svelte5Component, getContext, setContext } from "svelte";

export type Props<T> = T extends Svelte5Component<infer P> ? Omit<P, "$$events" | "$$slots"> : never;

export type Exports<T> = T extends Svelte5Component<infer _, infer E> ? E : never;

export const typedContext = <T extends Record<string, unknown>>(defaults: T) => {
  const set = <K extends keyof T>(key: K, value: T[K]) => setContext(key, value);
  const get = <K extends keyof T>(key: K) => getContext<T[K]>(key) ?? defaults[key];
  return { set, get };
};
