<script lang="ts" module>
  import {
    type BoundingBox,
    isIndex,
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
    } satisfies Record<AnyAnnotation["kind"], Partial<CSSStyleDeclaration>>;
  }

  class Comment {
    public static Make({ comment, props, key, commentStyle }: AnyAnnotation) {
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
        index: Number.NaN,
      };
    }

    public static Update(
      comment: ReturnType<typeof Comment.Make>,
      verticalOffset: number,
      localCenterX: number,
      { x, y }: DOMRect,
      index: number,
    ) {
      comment.left = x + localCenterX - comment.width / 2;
      comment.top = y - verticalOffset - comment.height;
      comment.index = index;
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
      index,
    }: ReturnType<typeof Comment.Make>) => ({
      left,
      top,
      width,
      height,
      index,
    });

    static readonly DurationMs = 500;

    private static readonly InitialStyle = {
      position: "absolute",
      opacity: "0",
      whiteSpace: "normal",
      width: "fit-content",
      height: "fit-content",
      zIndex: "10000",
      transition: transition(Comment.DurationMs, "opacity"),
    } satisfies Partial<CSSStyleDeclaration>;

    static readonly AnimateOnNext = ({
      element: { style },
    }: ReturnType<typeof Comment.Make>) => {
      requestAnimationFrame(() => {
        style.transition = transition(
          Comment.DurationMs,
          "opacity",
          "left",
          "top",
        );
      });
    };

    static readonly ApplyLayout = (
      comment: ReturnType<typeof Comment.Make>,
      { left, top }: BoundingBox,
    ) => {
      if (comment.firstRender) Comment.AnimateOnNext(comment);
      comment.element.style.opacity = "1";
      comment.element.style.left = `${left}px`;
      comment.element.style.top = `${top}px`;
      comment.firstRender = false;
    };
  }

  class Handle {
    public static Make(
      { left, right, topOffset, divisions }: THandle,
      { y }: DOMRect,
      { connector }: AnyAnnotation,
    ) {
      const top = y - topOffset;
      const width = right - left;

      const bar = document.createElement("div");

      set.css(bar, Handle.InitialStyle, connector);

      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
      bar.style.width = `${width}px`;
      bar.style.height = `${topOffset}px`;
      if (divisions.length === 1) bar.style.borderRight = "none";

      for (let i = 0; i < divisions.length; i++) {
        const division = divisions[i];
        const isEdge = i === 0 || i === divisions.length - 1;
        if (isEdge && division.top === top) continue;
        const tooth = document.createElement("div");
        set.css(tooth, Handle.InitialDivisionStyle);
        if (isEdge) {
          tooth.style.height = `${division.top - top - topOffset}px`;
          tooth.style.top = `${Handle.LineThickness + topOffset}px`;
          tooth.style.transform = `translateY(${-Handle.CornerRadius}px)`;
          const shift = `${-Handle.LineThickness}px`;
          i === 0 ? (tooth.style.left = shift) : (tooth.style.right = shift);
        } else {
          tooth.style.height = `${division.top - top}px`;
          tooth.style.top = `${Handle.CornerRadius}px`;
          tooth.style.transform = `translate(${-Handle.LineThickness / 2}px, ${-Handle.CornerRadius}px)`;
          tooth.style.left = `${division.x}px`;
        }

        bar.appendChild(tooth);
      }

      document.body.appendChild(bar);
      return bar;
    }

    public static Destroy(element: HTMLElement) {
      element.remove();
    }

    private static readonly LineThickness = 2;
    private static readonly CornerRadius = 4;

    private static readonly InitialStyle = {
      position: "absolute",
      boxSizing: "border-box",
      borderTop: `${Handle.LineThickness}px solid currentColor`,
      borderLeft: `${Handle.LineThickness}px solid currentColor`,
      borderRight: `${Handle.LineThickness}px solid currentColor`,
      borderBottom: "none",
      borderTopLeftRadius: `${Handle.CornerRadius}px`,
      borderTopRightRadius: `${Handle.CornerRadius}px`,
      background: "transparent",
      overflow: "visible",
    } satisfies Partial<CSSStyleDeclaration>;

    private static readonly InitialDivisionStyle = {
      position: "absolute",
      border: "none",
      borderLeft: `${Handle.LineThickness}px solid currentColor`,
      zIndex: "10000",
    } satisfies Partial<CSSStyleDeclaration>;
  }

  class Connector {
    public static Make() {
      const parent = document.createElement("div");
      parent.style.position = "absolute";
      parent.style.overflow = "visible";
      //set.css(element, Comment.InitialStyle, commentStyle);
      parent.style.color = "red";
      document.body.appendChild(parent);
      const connector = mount(ElbowConnector, {
        target: parent,
        props: { parent },
      }) as ElbowConnector;
      return { element: parent, connector };
    }

    public static Destroy({
      element,
      connector,
    }: ReturnType<typeof Connector.Make>) {
      unmount(connector);
      element.remove();
    }
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
  import type { Input, Handle as THandle } from "./worker.js";
  import { ThreadedLayout } from "./threading.js";

  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

  const layout = new ThreadedLayout();

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
  const handles = new Array<ReturnType<typeof Handle.Make>>();

  let version = Number.MIN_SAFE_INTEGER;

  const annotate = async (annotations?: AnyAnnotation[]) => {
    const indicatorLength = indicators.length;
    const verticalOffset = (annotations?.length ?? 0) * 10 + 10;

    let origin: Maybe<DOMRect>;
    let indicatorResult: Maybe<ReturnType<typeof sortAndAssign>>;
    let iBoxes: Maybe<Input["indicators"]>;
    let cBoxes: Maybe<Input["comments"]>;
    let keys: Maybe<Set<Key>>;

    if (annotations) {
      origin ??= container.getBoundingClientRect();
      iBoxes ??= [];
      cBoxes ??= new Array(annotations.length);

      for (let aIndex = 0; aIndex < annotations.length; aIndex++) {
        const annotation = annotations[aIndex];
        const { range, key } = annotation;

        (keys ??= new Set()).add(key);

        let bIndex: number;

        if (isIndex(range)) continue;
        else if (isSingleRange(range)) {
          bIndex = appendLocalBoundsOfRange(iBoxes, range, origin, chars);
        } else
          for (let rangeIndex = 0; rangeIndex < range.length; rangeIndex++) {
            const r = range[rangeIndex];
            const index = appendLocalBoundsOfRange(iBoxes, r, origin, chars);
            if (rangeIndex === 0) bIndex = index;
          }

        for (let i = bIndex!; i < iBoxes.length; i++) iBoxes[i].index = aIndex;

        let comment = comments.get(key);
        if (!comment) comments.set(key, (comment = Comment.Make(annotation)));
        Comment.Update(
          comment,
          verticalOffset,
          xCenter(iBoxes, bIndex!),
          origin,
          aIndex,
        );
        cBoxes[aIndex] = Comment.CloneForLayout(comment);
      }

      indicatorResult = adjustIndicatorsToBounds(
        annotations,
        iBoxes,
        indicators,
        container,
      );
    }

    for (let i = indicatorLength - 1; i >= 0; i--) {
      if (indicatorResult?.usedElementIndices.has(i)) continue;
      const removed = indicators.splice(i, 1)[0];
      Indicator.Destroy(removed);
    }

    for (const [key, comment] of comments.entries()) {
      if (keys?.has(key)) continue;
      comments.delete(key!);
      Comment.Destroy(comment);
    }

    for (const handle of handles) Handle.Destroy(handle);

    if (iBoxes?.length === 0) return;

    if (!origin || !cBoxes || !iBoxes || !annotations) return;

    for (const box of iBoxes) worldify(box, origin);

    let current = ++version;
    const stale = () => current !== version;

    const msg = await layout.compute({
      width: window.screen.width,
      height: origin.y - verticalOffset,
      comments: cBoxes,
      indicators: iBoxes,
    });

    const _comments = await msg(0);
    if (stale()) return;

    for (const layout of _comments) {
      const { key } = annotations[layout.index];
      const comment = comments.get(key)!;
      Comment.ApplyLayout(comment, layout);
    }

    const _handles = await msg(1);
    if (stale()) return;

    for (const handle of _handles)
      handles.push(Handle.Make(handle, origin, annotations[handle.index]));
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
    indicators.length = 0;
    for (const comment of comments.values()) Comment.Destroy(comment);
    comments.clear();
    connectors.clear();
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
  class="absolute left-0 bottom-0 xterm-rows text-neutral-600 max-w-full h-fit"
>
  <span> <!-- space for left margin, same as how xterm does it --></span>
  {#each content as char, index (index)}
    <!-- svelte-ignore binding_property_non_reactive -->
    <span bind:this={chars[index]}>{char}</span>{/each}
</div>

<style>
  div {
    white-space: pre-wrap !important;
  }

  span {
    display: inline-block;
    font-style: normal;
    transform: skewX(-15deg); /* apply visual skew */
    z-index: 2;
  }
</style>
