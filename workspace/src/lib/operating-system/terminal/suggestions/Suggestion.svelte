<script lang="ts" module>
  import {
    type BoundingBox,
    isIndex,
    type Range,
    resize,
    worldify,
    xCenter,
  } from "./math.js";
  import {
    type AnnotationDelay,
    type Indexed,
    type Key,
    type Keyed,
    type MaybeKeyed,
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

  const transition = (durationMs: number, ...keys: string[]) =>
    keys.map((key) => `${key} ${durationMs}ms ease`).join(", ");

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
      transition: transition(
        Indicator.DurationMs,
        "opacity",
        "left",
        "width",
        "background-color",
      ),
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
    public static Make({
      comment,
      props,
      key,
      commentStyle,
    }: AnyKeyedAnnotation) {
      const element = document.createElement("div");
      set.css(element, Comment.InitialStyle, commentStyle);

      document.body.appendChild(element);
      const renderer = mount(SnippetRenderer, {
        target: element,
        props: {
          snippet: comment,
          props,
        },
      });
      const { width, height } = element.getBoundingClientRect();
      return {
        key,
        element,
        renderer,
        width,
        height,
        firstRender: true,
        left: Number.NaN,
        top: Number.NaN,
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

    public static CloneForLayout = ({
      left,
      top,
      width,
      height,
      key,
    }: ReturnType<typeof Comment.Make>) => ({ left, top, width, height, key });

    static readonly DurationMs = 500;
    static readonly VerticalOffset = 20;

    private static readonly InitialStyle = {
      position: "absolute",
      opacity: "0",
      whiteSpace: "normal",
      width: "fit-content",
      height: "fit-content",
      zIndex: "10000",
      transition: transition(Comment.DurationMs, "opacity"),
    } satisfies Partial<CSSStyleDeclaration>;

    static readonly StartAnimating = ({ style }: HTMLElement) =>
      requestAnimationFrame(
        () =>
          (style.transition = transition(
            Comment.DurationMs,
            "opacity",
            "left",
            "top",
          )),
      );
  }

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

  function worldifyAndRemoveUnkeyed(
    boxes: MaybeKeyed<BoundingBox>[],
    origin: DOMRect,
  ): asserts boxes is Keyed<BoundingBox>[] {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const box = boxes[i];
      if (!box.key) boxes.splice(i, 1);
      else worldify(box, origin);
    }
  }
</script>

<script lang="ts">
  import { mount, tick, unmount } from "svelte";
  import {
    appendLocalBoundsOfRange,
    sortAndAssign,
    isSingleRange,
  } from "./math.js";
  import SnippetRenderer from "$lib/utils/SnippetRenderer.svelte";
  import ElbowConnector from "$lib/utils/elbow-connector/ElbowConnector.svelte";
  import type { Maybe } from "$lib/utils/index.js";
  import worker from "./worker?worker";
  import type { Input, Output } from "./worker.js";

  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

  const layoutWorker = new worker();
  let pendingLayout: Promise<Output> | undefined;

  const layout = async (input: Input) => {
    if (pendingLayout) await pendingLayout;
    layoutWorker.postMessage(input);
    pendingLayout = new Promise(
      (resolve) =>
        (layoutWorker.onmessage = ({ data }) => resolve(data as Output)),
    );
    return pendingLayout;
  };

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

  let version = Number.MIN_SAFE_INTEGER;

  const annotate = async (annotations?: AnyAnnotation[]) => {
    let current = ++version;
    const indicatorLength = indicators.length;

    let origin: Maybe<DOMRect>;
    let indicatorResult: Maybe<ReturnType<typeof sortAndAssign>>;
    let boxes: Maybe<MaybeKeyed<Indexed<BoundingBox>>[]>;
    let keys: Maybe<Set<Key>>;

    if (annotations) {
      origin ??= container.getBoundingClientRect();
      boxes ??= [];

      for (let noteIndex = 0; noteIndex < annotations.length; noteIndex++) {
        const { range, key } = annotations[noteIndex];

        let boxIndex: number;

        if (isIndex(range)) continue;
        else if (isSingleRange(range)) {
          boxIndex = appendLocalBoundsOfRange(boxes, range, origin, chars);
        } else
          for (let rangeIndex = 0; rangeIndex < range.length; rangeIndex++) {
            const r = range[rangeIndex];
            const index = appendLocalBoundsOfRange(boxes, r, origin, chars);
            if (rangeIndex === 0) boxIndex = index;
          }

        for (let i = boxIndex!; i < boxes.length; i++)
          boxes[i].index = noteIndex;

        if (!key) continue;

        for (let i = boxIndex!; i < boxes.length; i++) boxes[i].key = key;

        (keys ??= new Set()).add(key);
        const keyed = annotations[noteIndex] as AnyKeyedAnnotation;
        let comment = comments.get(key);
        if (!comment) comments.set(key, (comment = Comment.Make(keyed)));
        comment.left = origin.x + xCenter(boxes, boxIndex!) - comment.width / 2;
        comment.top = origin.y - Comment.VerticalOffset - comment.height;
      }

      indicatorResult = adjustIndicatorsToBounds(
        annotations,
        boxes,
        indicators,
        container,
      );
    }

    for (let i = indicatorLength - 1; i >= 0; i--) {
      if (indicatorResult?.usedElementIndices.has(i)) continue;
      const removed = indicators.splice(i, 1)[0];
      Indicator.Destroy(removed);
    }

    let commentBoxes: Maybe<Keyed<BoundingBox>[]>;
    for (const [key, comment] of comments.entries())
      if (keys?.has(key))
        (commentBoxes ??= []).push(Comment.CloneForLayout(comment));
      else {
        comments.delete(key);
        Comment.Destroy(comment);
      }

    if (!commentBoxes || !origin || !boxes) return;

    worldifyAndRemoveUnkeyed(boxes, origin);

    const layoutResult = await layout({
      width: window.screen.width,
      height: origin.y - Comment.VerticalOffset,
      comments: commentBoxes,
      indicators: boxes,
    });

    if (current !== version) return;

    for (const { key, left, top } of layoutResult.comments) {
      const comment = comments.get(key)!;
      if (comment.firstRender) Comment.StartAnimating(comment.element);
      comment.element.style.opacity = "1";
      comment.element.style.left = `${left}px`;
      comment.element.style.top = `${top}px`;
      comment.firstRender = false;
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
    for (const indicator of indicators) Indicator.Destroy(indicator);
    for (const comment of comments.values()) Comment.Destroy(comment);
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
