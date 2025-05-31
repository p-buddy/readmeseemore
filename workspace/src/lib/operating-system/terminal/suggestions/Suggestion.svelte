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
    type Indexed,
    type Key,
    type Keyed,
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
      { comment, props, key }: AnyKeyedAnnotation,
      targetX: number,
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

      const { width, height } = element.getBoundingClientRect();
      element.style.left = `${targetX - width / 2}px`;
      element.style.opacity = "1";
      return {
        key,
        element,
        renderer,
        width,
        height,
        x: -1,
        y: -1,
        targetX: -1,
      };
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
    static readonly VerticalOffset = 40;

    private static readonly InitialStyle = {
      position: "absolute",
      bottom: `calc(100% + ${Comment.VerticalOffset}px)`,
      opacity: "0",
      whiteSpace: "normal",
      width: "fit-content",
      transition: ["opacity", "left", "bottom"]
        .map((prop): string => `${prop} ${Comment.DurationMs}ms ease`)
        .join(", "),
    } satisfies Partial<CSSStyleDeclaration>;
  }

  /** Because a range can extend onto multiple lines, it's possible that a single range can have multiple bounds / boxes. */
  const appendBoundsAndSetIndex = (
    index: number,
    bounds: Indexed<BoundingBox>[],
    range: Range,
    origin: DOMRect,
    elements: HTMLElement[],
  ) => {
    const start = appendLocalBoundingBoxesOfRange(
      bounds,
      range,
      origin,
      elements,
    );
    for (let i = start; i < bounds.length; i++) bounds[i].index = index;
    return start;
  };

  const adjustIndicatorsToBounds = (
    annotations: AnyAnnotation[],
    boundingBoxes: Indexed<BoundingBox>[],
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
  import ElbowConnector from "$lib/utils/elbow-connector/ElbowConnector.svelte";
  import { computeLayout, apply, type Entry } from "./layout.js";

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
  const connectors = new Map<Key, ElbowConnector[]>();

  const annotate = (annotations?: AnyAnnotation[]) => {
    const { length } = indicators;
    let origin: DOMRect;

    let indicatorResult: ReturnType<typeof sortAndAssign> | undefined;
    let keys: Set<Key> | undefined;

    if (annotations) {
      origin ??= container.getBoundingClientRect();
      const boxes = new Array<Indexed<BoundingBox>>();

      for (let noteIndex = 0; noteIndex < annotations.length; noteIndex++) {
        const { range, key } = annotations[noteIndex];

        let boxIndex: number;

        if (isIndex(range)) continue;
        else if (isSingleRange(range)) {
          boxIndex = appendBoundsAndSetIndex(
            noteIndex,
            boxes,
            range,
            origin,
            chars,
          );
        } else
          for (let rangeIndex = 0; rangeIndex < range.length; rangeIndex++) {
            const index = appendBoundsAndSetIndex(
              noteIndex,
              boxes,
              range[rangeIndex],
              origin,
              chars,
            );
            if (rangeIndex === 0) boxIndex = index;
          }

        if (!key) continue;

        (keys ??= new Set()).add(key);
        const keyed = annotations[noteIndex] as AnyKeyedAnnotation;

        const localX = xCenter(boxes, boxIndex!);

        let comment = comments.get(key);
        if (!comment)
          comments.set(key, (comment = Comment.Make(container, keyed, localX)));

        const worldX = origin.x + localX;
        const worldY = origin.y - Comment.VerticalOffset - comment.height / 2;
        comment.targetX = worldX;
        comment.x = worldX;
        comment.y = worldY;
      }

      const adjust = adjustIndicatorsToBounds;
      indicatorResult = adjust(annotations, boxes, indicators, container);
    }

    for (let i = length - 1; i >= 0; i--) {
      if (indicatorResult?.usedElementIndices.has(i)) continue;
      const removed = indicators.splice(i, 1)[0];
      Indicator.Destroy(removed);
    }

    let nodes: Keyed<Entry>[] | undefined;
    for (const [key, comment] of comments.entries())
      if (keys?.has(key)) (nodes ??= []).push(comment);
      else {
        comments.delete(key);
        Comment.Destroy(comment);
      }

    if (!nodes) return;

    computeLayout(
      window.screen.width,
      origin!.y - Comment.VerticalOffset,
      nodes,
    );

    for (const node of nodes)
      apply(node, comments.get(node.key)!.element, origin!);
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
