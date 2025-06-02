import type { Snippet } from "svelte";
import type { Ranges } from "./math.js";

type CSS = {
  style?: Partial<CSSStyleDeclaration>,
  class?: string | string[],
  variables?: Record<string, string>,
  noDefaultStyle?: true,
}

export type Key = string | number | symbol;

export type Keyed<T> = T & { key: Key };
export type MaybeKeyed<T> = T & { key?: Key };

export type Indexed<T> = T & { index: number };

/** CRITICAL ASSUMPTION: Only a single annotation entry should have a given key.*/
type KeyedAnnotation<T> = Keyed<{
  /**
   *  As a matter of principle, `comment` snippets should be static (e.g. valid for the course of their rendering). 
   * `range` should be the dynamic property. 
   * */
  comment: Snippet<[T]>,
  commentStyle?: CSS,
  props: T,
}>;

type NotKeyedAnnotation = { [k in keyof KeyedAnnotation<any>]?: undefined };

export type SuggestionAnnotation<T = undefined, KeyedOverride = false> = {
  kind: "highlight" | "top-hook",
  /** CRITICAL ASSUMPTION: Ranges in a colllection of annotations will NOT overlap. */
  range: Ranges;
  indicator?: CSS,
  connector?: CSS,
} & (
    KeyedOverride extends true
    /**/ ? KeyedAnnotation<T>
    /**/ : NonNullable<T> extends never
      /**/ ? NotKeyedAnnotation
      /**/ : KeyedAnnotation<T>
  );

export type AnnotationDelay = {
  key: Key,
  delayMs: number,
}

export const set = {
  variables: (element: HTMLElement, variables: Required<CSS>["variables"]) => {
    for (const [key, value] of Object.entries(variables))
      element.style.setProperty(key, value);
  },
  style: (element: HTMLElement, style: Required<CSS>["style"]) => {
    for (const [key, value] of Object.entries(style))
      element.style[key as any] = value as any;
  },
  class: (element: HTMLElement, className: string | string[]) =>
    Array.isArray(className)
      ? element.classList.add(...className)
      : element.classList.add(className),
  css: (element: HTMLElement, defaultStyle: Required<CSS>["style"], css?: CSS,) => {
    if (!css?.noDefaultStyle) set.style(element, defaultStyle);
    if (css?.style) set.style(element, css.style);
    if (css?.class) set.class(element, css.class);
    if (css?.variables) set.variables(element, css.variables);
  },
};