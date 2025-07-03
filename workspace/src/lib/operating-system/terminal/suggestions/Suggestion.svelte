<script lang="ts" module>
  import {
    type BoundingBox,
    cloneToBoundingBox,
    isIndex,
    type SingleOrArray,
    worldify,
    xCenter,
  } from "./math.js";
  import {
    type AnnotationDelay,
    type Indexed,
    type Key,
    type SuggestionAnnotation,
  } from "./common.svelte.js";
  import { Indicator, Comment, Handle, type Made } from "./elements.js";
  import { ThreadedLayout } from "./threading.js";

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

  const layout = new ThreadedLayout();
</script>

<script lang="ts">
  import { mount, tick, unmount } from "svelte";
  import {
    appendLocalBoundsOfRange,
    sortAndAssign,
    isSingleRange,
  } from "./math.js";
  import ElbowConnector from "$lib/utils/elbow-connector/ElbowConnector.svelte";
  import { type Maybe } from "$lib/utils/index.js";
  import type { Input } from "./layout-worker.js";
  import { route, Rectangle } from "@blocksuite/connector";

  import type { Padding } from "./connections.js";

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

  const layoutPadding: Padding = {
    edge: Handle.CornerRadius,
    division: 2,
  };

  const chars = new Array<HTMLSpanElement>();
  fillChars(content, chars);

  let container: HTMLDivElement;

  const indicators = new Array<Made<typeof Indicator>>();
  const comments = new Map<Key, Made<typeof Comment>>();
  const connectors = new Map<Key, ElbowConnector>();
  const handles = new Map<Key, Made<typeof Handle>>();

  let version = Number.MIN_SAFE_INTEGER;

  const annotate = async (
    annotations?: AnyAnnotation[],
    restricted?: SingleOrArray<DOMRect>,
  ) => {
    const indicatorLength = indicators.length;
    const padding = {
      top: (annotations?.length ?? 0) * 10 + 10,
      bottom: 10,
      left: 10,
      right: 10,
    };

    let origin: Maybe<DOMRect>;
    let indicatorResult: Maybe<ReturnType<typeof sortAndAssign>>;
    let iBoxes: Maybe<Input["indicators"]>;
    let cBoxes: Maybe<Input["comments"]>;
    let cBoxChildren: Maybe<Input["commentChildren"]>;
    let keys: Maybe<Set<Key>>;

    if (annotations) {
      origin ??= container.getBoundingClientRect();
      iBoxes ??= [];
      cBoxes ??= new Array(annotations.length);
      cBoxChildren ??= new Array(annotations.length);

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
          padding.top,
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

    for (const [key, comment] of comments) {
      if (keys?.has(key)) continue;
      comments.delete(key);
      Comment.Destroy(comment);
    }

    const handlePool = new Array<Made<typeof Handle>>();
    const cleanup = () => {
      for (const handle of handlePool) Handle.Destroy(handle);
      handlePool.length = 0;
    };

    for (const [key, handle] of handles) {
      if (keys?.has(key)) continue;
      handles.delete(key);
      handlePool.push(handle);
    }

    if (iBoxes?.length === 0) return cleanup();

    if (!origin || !cBoxes || !cBoxChildren || !iBoxes || !annotations)
      return cleanup();

    for (const box of iBoxes) worldify(box, origin);

    let current = ++version;
    const stale = () => {
      const isStale = current !== version;
      if (isStale) cleanup();
      return isStale;
    };

    const body = document.body.getBoundingClientRect();
    const restrictedAreas = [cloneToBoundingBox(origin, padding)];
    if (restricted)
      if (Array.isArray(restricted))
        for (const rect of restricted)
          restrictedAreas.push(cloneToBoundingBox(rect));
      else restrictedAreas.push(cloneToBoundingBox(restricted));

    const { width, height } = body;
    const msg = await layout.compute({
      width,
      height,
      suggestionTop: origin.top,
      comments: cBoxes,
      commentChildren: cBoxChildren,
      indicators: iBoxes,
      restricted: restrictedAreas,
      padding: layoutPadding,
    });

    const _comments = await msg(0);

    if (stale()) return;

    const handlesPromise = msg(1);

    for (const layout of _comments) {
      const { key } = annotations[layout.index];
      const comment = comments.get(key)!;
      Comment.ApplyLayout(comment, layout);
    }

    const _handles = await handlesPromise;
    if (stale()) return;
    const connectionsPromise = msg(2);

    for (const handle of _handles) {
      const annotation = annotations[handle.index];
      const existing = handles.get(annotation.key);
      if (existing) Handle.Update(handle, origin, existing, annotation);
      else if (handlePool.length === 0)
        handles.set(annotation.key, Handle.Make(handle, origin, annotation));
      else {
        const pooled = handlePool.pop()!;
        Handle.Update(handle, origin, pooled, annotation);
        handles.set(annotation.key, pooled);
      }
    }

    const connections = await connectionsPromise;
    if (stale()) return;

    const rectangles = Array.from(
      comments.values().map(Comment.MakeChildRectangle),
    );
    rectangles.push(
      new Rectangle(0, -1, width, 1),
      new Rectangle(0, height, width, 1),
      new Rectangle(-1, 0, 1, height),
      new Rectangle(width, 0, 1, height),
      new Rectangle(origin.x, origin.y, origin.width, origin.height),
    );

    for (const { left, top, width, height } of restrictedAreas)
      rectangles.push(new Rectangle(left, top, width, height));

    for (const { x, index, topOffset } of connections) {
      const { key } = annotations[index];
      const comment = comments.get(key)!;
      let elbow = connectors.get(key);
      if (!elbow) {
        elbow = mount(ElbowConnector, {
          target: document.body,
          props: {
            parent: document.body,
            style: "z-index: 10001;",
          },
        });
        connectors.set(key, elbow);
      }

      elbow.update(
        route(rectangles, [
          { x, y: origin.y - topOffset },
          {
            x: comment.left + comment.child.left,
            y: comment.top + comment.child.top,
          },
        ]),
      );
    }

    for (const [key, elbow] of connectors) {
      if (keys?.has(key)) continue;
      connectors.delete(key);
      unmount(elbow);
    }

    console.log("computed1");

    cleanup();
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
    restricted?: SingleOrArray<DOMRect>,
    delay?: AnnotationDelay,
  ) => {
    content = _content;
    fillChars(content, chars);
    const fire = () => annotate(annotations, restricted);

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
    for (const handle of handles.values()) Handle.Destroy(handle);
    handles.clear();
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
