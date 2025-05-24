<script lang="ts" module>
  import {
    type BoundingBox,
    isIndex,
    type Range,
    resize,
    xCenter,
  } from "./math.js";
  import {
    type AnnotationDelay,
    type Key,
    type SuggestionAnnotation,
    set,
  } from "./common.svelte.js";

  export type Props = {
    inMs: number;
    outMs: number;
    content: string;
  };

  type AnyAnnotation = SuggestionAnnotation<any>;
  type AnyKeyedAnnotation = SuggestionAnnotation<any, true>;

  /** from inline style of element with class "xterm-viewport" */
  const terminalBackground = "rgb(24, 24, 24)";

  const fillChars = <T,>(content: string, chars: T[]) => {
    for (let i = chars.length; i < content.length; i++)
      chars.push(undefined as T);
    chars.length = content.length;
  };

  class Indicator {
    static Highlight = class {
      public static Resize({ style }: HTMLElement, bbox: BoundingBox) {
        const shrink = 2;
        const width = Math.max(bbox.width - shrink - 1, 0.5);
        const left = bbox.left + shrink;
        resize(style, bbox, { width, left });
        style.maskImage =
          width > 2
            ? "linear-gradient(to right, transparent 0px, black 2px, black calc(100% - 2px), transparent 100%)"
            : "linear-gradient(to right, transparent, black 40%, black 60%, transparent)";
      }
    };

    public static Resize(
      element: HTMLElement,
      { kind }: AnyAnnotation,
      bbox: BoundingBox,
    ) {
      switch (kind) {
        case "highlight":
          Indicator.Highlight.Resize(element, bbox);
          break;
        case "top-hook":
          resize(element.style, bbox);
          break;
      }
    }

    public static Make(
      container: HTMLDivElement,
      annotation: AnyAnnotation,
      bbox: BoundingBox,
    ) {
      const element = document.createElement("div");
      set.style(element, Indicator.InitialStyle);
      Indicator.Resize(element, annotation, bbox);
      container.appendChild(element);
      return element;
    }

    public static Destroy(element: HTMLElement) {
      element.style.opacity = "0";
      setTimeout(() => element.remove(), Indicator.DurationMs);
    }

    public static Style(
      element: HTMLElement,
      { indicator, kind }: AnyAnnotation,
    ) {
      set.css(element, Indicator.DefaultStylesByKind[kind], indicator);
    }

    private static readonly DurationMs = 300;

    private static readonly InitialStyle = {
      position: "absolute",
      transform: "skewX(-15deg)",
      backgroundColor: "transparent",
      borderRadius: "0.2rem",
      opacity: "0",
      transition: ["opacity", "left", "width", "background-color"]
        .map((prop): string => `${prop} ${Indicator.DurationMs}ms ease`)
        .join(", "),
    } satisfies Partial<CSSStyleDeclaration>;

    private static readonly DefaultStylesByKind = {
      highlight: {
        opacity: "0.4",
        backgroundColor: "white",
      },
      "top-hook": {
        opacity: "1",
      },
    } satisfies Record<
      SuggestionAnnotation["kind"],
      Partial<CSSStyleDeclaration>
    >;
  }

  class Comment {
    public static Make(
      container: HTMLDivElement,
      { comment, props }: AnyKeyedAnnotation,
    ) {
      const element = document.createElement("div");
      set.style(element, Comment.InitialStyle);
      container.appendChild(element);
      const renderer = mount(SnippetRenderer, {
        target: element,
        props: {
          snippet: comment,
          props,
        },
      });
      return { element, renderer };
    }

    public static Destroy({
      element,
      renderer,
    }: ReturnType<typeof Comment.Make>) {
      element.style.opacity = "0";
      setTimeout(
        () => (unmount(renderer), element.remove()),
        Comment.DurationMs,
      );
    }

    private static readonly DurationMs = 300;

    private static readonly InitialStyle = {
      position: "absolute",
      top: "-100%",
      opacity: "0",
      transition: ["opacity", "left", "top"]
        .map((prop): string => `${prop} ${Comment.DurationMs}ms ease`)
        .join(", "),
    } satisfies Partial<CSSStyleDeclaration>;
  }

  type BoxWith<T> = BoundingBox & T;

  const appendBoundsAndSetIndex = (
    index: number,
    bounds: BoxWith<{ index: number }>[],
    range: Range,
    origin: DOMRect,
    elements: HTMLElement[],
  ) => {
    const added = appendLocalBoundingBoxesOfRange(
      bounds,
      range,
      origin,
      elements,
    ) as typeof bounds | (typeof bounds)[number];
    if (Array.isArray(added))
      for (let i = 0; i < added.length; i++) added[i].index = index;
    else added.index = index;
    return added;
  };

  const adjustIndicatorsToBounds = (
    annotations: AnyAnnotation[],
    boundingBoxes: BoxWith<{ index: number }>[],
    indicators: HTMLElement[],
    container: HTMLDivElement,
  ) => {
    const result = sortAndAssign(boundingBoxes, indicators);
    for (let i = 0; i < boundingBoxes.length; i++) {
      const bbox = boundingBoxes[i];
      const annotation = annotations[bbox.index];
      if (result.assignments.has(i)) {
        const element = result.assignments.get(i)!;
        Indicator.Resize(element, annotation, bbox);
        Indicator.Style(element, annotation);
      } else {
        const element = Indicator.Make(container, annotation, bbox);
        indicators.push(element);
        requestAnimationFrame(() => Indicator.Style(element, annotation));
      }
    }
    return result;
  };
</script>

<script lang="ts">
  import { mount, tick, unmount } from "svelte";
  import {
    appendLocalBoundingBoxesOfRange,
    sortAndAssign,
    isSingleRange,
  } from "./math.js";
  import SnippetRenderer from "$lib/utils/SnippetRenderer.svelte";

  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

  export const visible = <AwaitComplete extends true | undefined = undefined>(
    condition: boolean,
    awaitComplete?: AwaitComplete,
  ) => {
    isVisible = condition;
    type Return = AwaitComplete extends true ? Promise<void> : void;
    if (!awaitComplete) return void 0 as Return;
    const delay = (condition ? inMs : outMs) + 1;
    return new Promise((resolve) => setTimeout(resolve, delay)) as Return;
  };

  const chars = new Array<HTMLSpanElement>();
  fillChars(content, chars);

  let container: HTMLDivElement;
  const indicators = new Array<ReturnType<typeof Indicator.Make>>();
  const comments = new Map<Key, ReturnType<typeof Comment.Make>>();

  const annotate = (annotations?: AnyAnnotation[]) => {
    const { length } = indicators;
    let indicatorResult: ReturnType<typeof sortAndAssign> | undefined;
    let boxesByKey:
      | Map<Key, ReturnType<typeof appendBoundsAndSetIndex>>
      | undefined;

    if (annotations) {
      const boundingBoxes = new Array<BoxWith<{ index: number }>>();
      const origin = container.getBoundingClientRect();

      for (let index = 0; index < annotations.length; index++) {
        const { range, key } = annotations[index];
        if (key && !comments.has(key))
          comments.set(
            key,
            Comment.Make(container, annotations[index] as AnyKeyedAnnotation),
          );

        if (isIndex(range)) continue;
        else if (isSingleRange(range)) {
          const boxes = appendBoundsAndSetIndex(
            index,
            boundingBoxes,
            range,
            origin,
            chars,
          );
          if (key) (boxesByKey ??= new Map()).set(key, boxes);
        } else
          for (const _range of range) {
            const boxes = appendBoundsAndSetIndex(
              index,
              boundingBoxes,
              _range,
              origin,
              chars,
            );
            if (key) (boxesByKey ??= new Map()).set(key, boxes);
          }
      }

      indicatorResult = adjustIndicatorsToBounds(
        annotations,
        boundingBoxes,
        indicators,
        container,
      );

      if (boxesByKey)
        for (const [key, boxes] of boxesByKey.entries()) {
          const { element } = comments.get(key)!;
          element.style.left = `${xCenter(boxes)}px`;
          element.style.opacity = "1";
        }
    }

    for (let i = length - 1; i >= 0; i--) {
      if (indicatorResult?.usedElementIndices.has(i)) continue;
      const removed = indicators.splice(i, 1)[0];
      Indicator.Destroy(removed);
    }

    for (const [key, { element, renderer }] of comments.entries()) {
      if (boxesByKey?.has(key)) continue;
      comments.delete(key);
      Comment.Destroy({ element, renderer });
    }
  };

  const pending = {
    delay: undefined as AnnotationDelay | undefined,
    interval: undefined as ReturnType<typeof setTimeout> | undefined,
    time: undefined as number | undefined,
  };

  const clearPending = () => {
    pending.delay = undefined;
    if (pending.interval) clearInterval(pending.interval);
    pending.interval = undefined;
    pending.time = undefined;
  };

  export const update = <T,>(
    _content: string,
    annotations?: SuggestionAnnotation<T>[],
    delay?: AnnotationDelay,
  ) => {
    content = _content;
    fillChars(content, chars);
    const fire = () => annotate(annotations as AnyAnnotation[]);

    if (!delay) {
      clearPending();
      tick().then(fire);
      return;
    }

    const { key, delayMs } = delay;
    const now = performance.now();

    if (pending.delay?.key !== key) {
      clearPending();
      pending.time = now;
      pending.delay = delay;
      pending.interval = setTimeout(fire, delayMs);
      return;
    }

    const elapsed = now - pending.time!;
    if (elapsed < delayMs) {
      clearInterval(pending.interval!);
      pending.interval = setTimeout(fire, delayMs - elapsed);
    } else {
      clearPending();
      tick().then(fire);
    }
  };

  export const dispose = () => {
    clearPending();
  };
</script>

<div
  bind:this={container}
  style:background-color={terminalBackground}
  style:color={"rgb(150, 150, 150)"}
  style:transition-duration={!isVisible ? `${outMs}ms` : `${inMs}ms`}
  class:opacity-100={isVisible}
  class:opacity-0={!isVisible}
  style:--unsafe-color="var(--color-yellow-400)"
  style:--invalid-color="var(--color-red-400)"
  class="absolute left-0 top-0 xterm-rows text-neutral-600"
>
  <span> <!-- space for left margin, same as how xterm does it --></span>
  {#each content as char, index (index)}
    <span bind:this={chars[index]}>{char}</span>{/each}
</div>

<style>
  span {
    display: contents;
    font-style: normal;
    transform: skewX(-15deg); /* apply visual skew */
    z-index: 2;
  }
</style>
