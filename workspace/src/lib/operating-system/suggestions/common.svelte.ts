import type { Snippet } from "svelte";
import type { Ranges } from "./math.js";

type CSS = {
  style?: Partial<CSSStyleDeclaration>,
  class?: string | string[],
  noDefaultStyle?: true,
}

type Keyed<T> = {
  key: string | number | symbol,
  /**
   *  As a matter of principle, `comment` snippets should be static (e.g. valid for the course of their rendering). 
   * `range` should be the dynamic property. 
   * */
  comment: Snippet<[T]>,
  props: T,
  delay?: number,
};

type NotKeyed = { [k in keyof Keyed<any>]?: undefined };

export type SuggestionAnnotation<T = undefined> = {
  kind: "highlight" | "top-hook",
  range: Ranges;
  indicator?: CSS,
  connector?: CSS,
} & (NonNullable<T> extends never ? NotKeyed : Keyed<T>);

export const set = {
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
  },
}