import type { Component, ComponentType, Snippet } from "svelte";

export type ExtractComponents<T extends Record<string, any>> = {
  components: { [K in keyof T as T[K] extends Component<any, any, any> | ComponentType<any> ? K : never]: T[K] };
  snippets: { [K in keyof T as T[K] extends Snippet<any[]> ? K : never]: T[K] };
};
