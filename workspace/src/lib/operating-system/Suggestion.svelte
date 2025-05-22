<script lang="ts" module>
  export type Props = {
    inMs: number;
    outMs: number;
    content: string;
  };

  /** from inline style of element with class "xterm-viewport" */
  const terminalBackground = "rgb(24, 24, 24)";

  const fillChars = <T,>(content: string, chars: T[]) => {
    for (let i = chars.length; i < content.length; i++)
      chars.push(undefined as T);
    chars.length = content.length;
  };

  const float = (query: string | number) =>
    typeof query === "string" ? parseFloat(query) : query;

  type Ranges = Required<Annotation>["ranges"];
  type Range = [number, number];

  const isSingleRange = (ranges: Ranges): ranges is Range =>
    !Array.isArray(ranges[0]);

  type BoundingBox = Pick<DOMRect, "left" | "top" | "width" | "height">;

  const sortBoxes = (a: BoundingBox, b: BoundingBox) =>
    a.top === b.top ? a.left - b.left : a.top - b.top;
  const sortStyleBoxes = (a: HTMLElement, b: HTMLElement) =>
    a.style.top === b.style.top
      ? float(a.style.left) - float(b.style.left)
      : float(a.style.top) - float(b.style.top);

  const resize = (
    element: HTMLElement,
    rect: BoundingBox,
    shrink: number = 2,
  ) => {
    element.style.left = `${rect.left + shrink}px`;
    element.style.top = `${rect.top}px`;
    const width = Math.max(rect.width - shrink - 1, 0.5);
    element.style.width = `${width}px`;
    element.style.height = `${rect.height}px`;
    element.style.maskImage =
      width > 2
        ? "linear-gradient(to right, transparent 0px, black 2px, black calc(100% - 2px), transparent 100%)"
        : "linear-gradient(to right, transparent, black 40%, black 60%, transparent)";
  };

  const style = (element: HTMLElement, annotation: Annotation) => {
    element.style.backgroundColor = `var(--${annotation.severity}-color)`;
    element.style.opacity = "0.5";
  };

  type StyledBoundingBox = Pick<HTMLDivElement["style"], keyof BoundingBox>;

  type MaybeBox = BoundingBox | StyledBoundingBox;
  const distance = (a: MaybeBox, b: MaybeBox) => {
    const dx = float(a.left) - float(b.left);
    const dy = float(a.top) - float(b.top);
    return Math.sqrt(dx * dx + dy * dy);
  };

  const overlap = (a: MaybeBox, b: MaybeBox): boolean =>
    float(a.left) < float(b.left) + float(b.width) &&
    float(a.left) + float(a.width) > float(b.left) &&
    float(a.top) < float(b.top) + float(b.height) &&
    float(a.top) + float(a.height) > float(b.top);

  type AssignmentPayload = {
    assignments: Map<number, HTMLElement>;
    usedElementIndices: Set<number>;
  };

  const greedilyAssignBackdrops = (
    boxes: BoundingBox[],
    elements: HTMLElement[],
  ): AssignmentPayload => {
    const payload: AssignmentPayload = {
      assignments: new Map(),
      usedElementIndices: new Set(),
    };
    boxes.sort(sortBoxes);
    elements.sort(sortStyleBoxes);

    let lastOverlap = -1;
    for (let i = 0; i < boxes.length; i++)
      for (let j = lastOverlap + 1; j < elements.length; j++) {
        if (payload.usedElementIndices.has(j)) continue;
        if (overlap(elements[j].style, boxes[i])) {
          payload.assignments.set(i, elements[j]);
          payload.usedElementIndices.add(j);
          lastOverlap = j;
          break;
        }
      }

    for (let i = 0; i < boxes.length; i++) {
      if (payload.assignments.has(i)) continue;
      const targetBox = boxes[i];
      const best = { index: -1, distance: Infinity };
      for (let j = 0; j < elements.length; j++) {
        if (payload.usedElementIndices.has(j)) continue;
        const dist = distance(elements[j].style, targetBox);
        if (dist >= best.distance) continue;
        best.index = j;
        best.distance = dist;
      }
      if (best.index === -1) continue;
      payload.usedElementIndices.add(best.index);
      payload.assignments.set(i, elements[best.index]);
    }

    return payload;
  };

  const bounding = (elements: HTMLElement[], range: Range, origin: DOMRect) => {
    const start = elements[range[0]].getBoundingClientRect();
    const end = elements[range[1] - 1].getBoundingClientRect();
    if (end.top === start.top)
      return {
        left: start.left - origin.left,
        top: start.top - origin.top,
        width: end.left - start.left + end.width,
        height: start.height,
      } satisfies BoundingBox;
    const boundingBoxes = new Array<BoundingBox>();
    let left = start;
    let previous = start;
    for (let i = range[0] + 1; i < range[1] - 2; i++) {
      const current = elements[i].getBoundingClientRect();
      if (left.top !== current.top) {
        boundingBoxes.push({
          left: left.left - origin.left,
          top: left.top - origin.top,
          width: current.left - left.left + current.width,
          height: left.height,
        });
        left = current;
      }
      previous = current;
    }
    if (previous.top === end.top)
      boundingBoxes.push({
        left: left.left - origin.left,
        top: left.top - origin.top,
        width: end.left - left.left + end.width,
        height: left.height,
      });
    return boundingBoxes;
  };

  type BoxWithAnnotationIndex = BoundingBox & { index: number };
  const withIndex = (
    bbox: BoundingBox,
    index: number,
  ): BoxWithAnnotationIndex => {
    const casted = bbox as BoxWithAnnotationIndex;
    casted.index = index;
    return casted;
  };
</script>

<script lang="ts">
  import type { Annotation } from "$lib/file-tree/ItemNameAnnotations.svelte";

  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

  let annotations = $state<Annotation[]>();

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

  export const update = (_content: string, _annotations?: Annotation[]) => {
    content = _content;
    fillChars(content, chars);
    annotations = _annotations;
  };

  let container: HTMLDivElement;

  const backdrops = new Array<HTMLDivElement>();

  const backdrop = (rect: BoundingBox) => {
    const element = document.createElement("div");
    element.style.position = "absolute";
    element.style.transform = "skewX(-15deg)";
    element.style.backgroundColor = "transparent";
    element.style.borderRadius = "0.2rem";
    element.style.opacity = "0";
    element.style.transition =
      "opacity 0.3s ease, left 0.3s ease, width 0.3s ease, background-color 0.3s ease";
    resize(element, rect);
    container.appendChild(element);
    backdrops.push(element);
    return element;
  };

  $effect(() => {
    // assume ranges do not overlap
    if (!annotations) return;
    const boundingBoxes = new Array<BoxWithAnnotationIndex>();
    const origin = container.getBoundingClientRect();
    for (let i = 0; i < annotations.length; i++) {
      const { ranges } = annotations[i];
      if (!ranges) continue;
      if (isSingleRange(ranges)) {
        const bbox = bounding(chars, ranges, origin);
        if (Array.isArray(bbox))
          for (const box of bbox) boundingBoxes.push(withIndex(box, i));
        else boundingBoxes.push(withIndex(bbox, i));
      } else
        for (const range of ranges) {
          const bbox = bounding(chars, range, origin);
          if (Array.isArray(bbox))
            for (const box of bbox) boundingBoxes.push(withIndex(box, i));
          else boundingBoxes.push(withIndex(bbox, i));
        }
    }
    const { length } = backdrops;
    const mapping = greedilyAssignBackdrops(boundingBoxes, backdrops);
    for (let i = 0; i < boundingBoxes.length; i++) {
      const bbox = boundingBoxes[i];
      const annotation = annotations[bbox.index];
      if (mapping.assignments.has(i)) {
        const element = mapping.assignments.get(i)!;
        resize(element, bbox);
        style(element, annotation);
      } else {
        const element = backdrop(bbox);
        requestAnimationFrame(() => style(element, annotation));
      }
    }

    for (let i = length - 1; i >= 0; i--) {
      if (mapping.usedElementIndices.has(i)) continue;
      backdrops[i].remove();
      backdrops.splice(i, 1);
    }
  });
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
