import { Layout, type Node, type Link, type InputNode } from 'webcola';
import type { BoundingBox } from './math.js';
import type { Indexed } from './common.svelte.js';
import { Timer, type Prettify } from '$lib/utils/index.js';
import { inPlaceResolveOverlapAndKeepInBounds } from './ai-generated.js';

type InputBox = Indexed<BoundingBox>;

const inputKeys = new Set(
  Object.keys(
    {
      left: null,
      top: null,
      width: null,
      height: null,
      index: null,
    } satisfies Record<keyof InputBox, null>
  )
);

type Center = Record<"x" | "y", number>;
type Rect = Center & Record<"width" | "height", number>;
type Horizontal = Pick<Rect, 'x' | 'width'>;
type Vertical = Pick<Rect, 'y' | 'height'>;

export type LayoutItem = Prettify<Partial<InputNode> & Required<Pick<InputNode, keyof Rect>>>;

type KeyOverlap = keyof InputNode & keyof InputBox;

const preserveKey = {
  index: true,
  width: false,
  height: false,
} satisfies Record<KeyOverlap, boolean>;

const preserved = (key: string): key is KeyOverlap =>
  preserveKey[key as KeyOverlap];

const tempKey = <K extends string>(key: K) => `_${key}` as K;

const preserve = (box: InputBox) => {
  for (const key in preserveKey)
    if (preserved(key) && box[key] !== undefined) {
      box[tempKey(key)] = box[key];
      delete box[key];
    }
}

const restore = (box: InputBox) => {
  for (const key in preserveKey)
    if (preserved(key) && box[tempKey(key)] !== undefined)
      box[key] = box[tempKey(key)];
}

const setCenter = (box: BoundingBox | LayoutItem) => {
  const { left, top, width, height } = box as BoundingBox;
  (box as LayoutItem).x = left + width / 2;
  (box as LayoutItem).y = top + height / 2;
}

function initAndAssert(boxes: (InputBox | LayoutItem | BoundingBox)[]): asserts boxes is LayoutItem[] {
  for (const box of boxes) {
    preserve(box as InputBox);
    setCenter(box);
  }
}

const point = (x: number, y: number) =>
  ({ x, y, fixed: 1, width: 0, height: 0 } satisfies InputNode) as LayoutItem;

const anchorX = (item: LayoutItem) => item.x;
const anchorY = (item: LayoutItem) => bottom(item);
const anchor = (item: LayoutItem) => point(anchorX(item), anchorY(item));

const left = ({ x, width }: Horizontal) => x - (width / 2);
const right = ({ x, width }: Horizontal) => x + (width / 2);
const top = ({ y, height }: Vertical) => y - (height / 2);
const bottom = ({ y, height }: Vertical) => y + (height / 2);

const overlapX = (a: Horizontal, b: Horizontal) =>
  Math.min(right(a), right(b)) - Math.max(left(a), left(b));

const overlapY = (a: Vertical, b: Vertical) =>
  Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));

const overlaps = (a: Horizontal & Vertical, b: Horizontal & Vertical) =>
  overlapX(a, b) > 0 && overlapY(a, b) > 0;

const inBounds = (entry: Horizontal & Vertical, width: number, height: number) =>
  left(entry) >= 0 && right(entry) <= width && top(entry) >= 0 && bottom(entry) <= height;

type Constraint = { axis: 'x' | 'y', left: number, right: number, gap: number, type: 'separation' | 'alignment' };

const type = 'separation';

const constrain = ({ height, width }: LayoutItem, index: number) => ({
  isRightOf: (other: number, gap?: number) =>
    ({ axis: 'x', left: other, right: index, gap: gap ?? width / 2, type }),
  isBelowOf: (other: number, gap?: number) =>
    ({ axis: 'y', left: other, right: index, gap: gap ?? height / 2, type }),
  isLeftOf: (other: number, gap?: number) =>
    ({ axis: 'x', left: index, right: other, gap: gap ?? width / 2, type }),
  isAboveOf: (other: number, gap?: number) =>
    ({ axis: 'y', left: index, right: other, gap: gap ?? height / 2, type }),
} satisfies Record<string, (other: number) => Constraint>);

type Override = { index: number, x: number, y: number };

const override = (index: number, { x, y }: LayoutItem) =>
  ({ index, x, y } satisfies Override);

const MAX_LAYOUT_ITERATIONS = 3;
const MAX_CYCLES = 5;
const MAX_VALID_LAYOUTS = 5;
const SERIALIZED_PROPERTIES = 2;
const SERIALIZED_LAYOUT_WIDTH = SERIALIZED_PROPERTIES * MAX_VALID_LAYOUTS;
const X_COST = 1;
const Y_COST = 2;
const ALLOWED_MS = 1000;

const write = (
  index: number, serialized: Float32Array, entries: LayoutItem[], length: number
) => {
  const base = SERIALIZED_PROPERTIES * index * length;
  for (let i = 0; i < length; i++) {
    const off = base + i * SERIALIZED_PROPERTIES;
    serialized[off] = entries[i].x;
    serialized[off + 1] = entries[i].y;
  }
}

const read = (
  index: number, serialized: Float32Array, entries: LayoutItem[], length: number
) => {
  const base = SERIALIZED_PROPERTIES * index * length;
  for (let i = 0; i < length; i++) {
    const off = base + i * SERIALIZED_PROPERTIES;
    entries[i].x = serialized[off];
    entries[i].y = serialized[off + 1];
  }
}

const cost = (entries: LayoutItem[], pureEntriesLength: number) => {
  let cost = 0;
  for (let i = 0; i < pureEntriesLength; i++) {
    const entry = entries[i];
    const anchor = entries[i + pureEntriesLength];
    const xOffset = anchor.x - entry.x;
    const yOffset = anchor.y - entry.y;
    cost += (xOffset * xOffset) * X_COST + (yOffset * yOffset) * Y_COST;
  }
  return cost;
}

const layoutCost = (
  serialized: Float32Array,
  serializedIndex: number,
  entries: LayoutItem[],
  pureEntriesLength: number
) => {
  read(serializedIndex, serialized, entries, pureEntriesLength);
  for (let i = 0; i < pureEntriesLength; i++) {
    const entry = entries[i];
    const anchor = entries[i + pureEntriesLength];
    anchor.x = anchorX(entry);
    anchor.y = anchorY(entry);
  }
  return cost(entries, pureEntriesLength);
}

const step = (
  layout: Layout,
  width: number,
  height: number,
  entries: LayoutItem[],
  overrides: Override[],
  pureEntriesLength: number,
  restrictedIndex: number,
  restrictedLength: number,
  serialized: Float32Array,
  serializedIndex: number,
) => {
  // For some reason, (2, 2, 2) is the fastest configuration.
  layout.start(2, 2, 2);
  for (const { index, x, y } of overrides) {
    entries[index].x = x;
    entries[index].y = y;
  }

  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  for (let i = 0; i < pureEntriesLength; i++) {
    minLeft = Math.min(minLeft, left(entries[i]));
    maxRight = Math.max(maxRight, right(entries[i]));
    minTop = Math.min(minTop, top(entries[i]));
    maxBottom = Math.max(maxBottom, bottom(entries[i]));
  }

  let nudgeRight = Math.abs(Math.min(0, minLeft));
  let nudgeDown = Math.abs(Math.min(0, minTop));
  let nudgeLeft = Math.max(0, maxRight - width);
  let nudgeUp = Math.max(0, maxBottom - height);

  for (let i = 0; i < pureEntriesLength; i++) {
    const entry = entries[i];
    entry.x += (nudgeRight - nudgeLeft);
    entry.y += (nudgeDown - nudgeUp);
    for (let j = 0; j < restrictedLength; j++) {
      const restricted = entries[restrictedIndex + j];
      if (!overlaps(entry, restricted)) continue;
      inPlaceResolveOverlapAndKeepInBounds(entry, restricted, width, height);
    }
  }

  for (let i = 0; i < pureEntriesLength; i++) {
    const entry = entries[i];
    for (let j = 0; j < pureEntriesLength; j++) {
      const other = entries[j];
      if (i === j || !overlaps(entries[i], entries[j])) continue;
      inPlaceResolveOverlapAndKeepInBounds(entry, other, width, height);
    }
  }

  for (let i = 0; i < pureEntriesLength; i++) {
    if (!inBounds(entries[i], width, height)) return false;
    for (let j = 0; j < restrictedLength; j++)
      if (overlaps(entries[i], entries[restrictedIndex + j])) return false;
    for (let j = 0; j < pureEntriesLength; j++) {
      if (i === j) continue;
      if (overlaps(entries[i], entries[j])) return false;
    }
  }

  write(serializedIndex, serialized, entries, pureEntriesLength);
  return true;
}


/**
 * Problematic phrases:
 * - "e ;/ eae " toggling the final space takes almost 1s to compute when `layout.start(1, 1, 1);` (second iteration)
 */
export const computeLayoutInPlace = (
  width: number, height: number, boxes: InputBox[], restricted: BoundingBox[]
) => {
  const timer = new Timer(false);

  boxes.sort((a, b) => a.left - b.left);

  const originalLength = boxes.length;

  initAndAssert(boxes);

  const overrides = new Array<Override>();

  for (let i = 0; i < originalLength; i++) {
    const box = anchor(boxes[i]);
    const index = boxes.push(box) - 1;
    overrides.push(override(index, box));
  }

  const topLeftIndex = boxes.push(point(0, 0)) - 1;
  const bottomRightIndex = boxes.push(point(width, height)) - 1;
  overrides.push(override(topLeftIndex, boxes[topLeftIndex]));
  overrides.push(override(bottomRightIndex, boxes[bottomRightIndex]));

  const constraints = Array<Constraint>();
  const links: Link<Node>[] = [];

  for (let i = 0; i < originalLength; i++) {
    const entry = boxes[i];
    const anchor = boxes[i + originalLength];
    links.push({ source: entry, target: anchor, length: height / 2 });
    constraints.push(constrain(entry, i).isRightOf(topLeftIndex));
    constraints.push(constrain(entry, i).isBelowOf(topLeftIndex));
    constraints.push(constrain(entry, i).isLeftOf(bottomRightIndex));
    constraints.push(constrain(entry, i).isAboveOf(bottomRightIndex));
  }

  const restrictedIndex = boxes.length;
  initAndAssert(restricted);
  for (let i = 0; i < restricted.length; i++) {
    const box = restricted[i];
    box.fixed = 1;
    const index = boxes.push(box) - 1;
    overrides.push(override(index, box));
  }

  const layouts = new Float32Array(originalLength * SERIALIZED_LAYOUT_WIDTH);

  write(0, layouts, boxes, originalLength);

  const maxAttempts = originalLength * MAX_CYCLES;
  let valid = 0;
  let attempts = 0;

  while (valid < MAX_VALID_LAYOUTS && attempts < maxAttempts && timer.elapsed < ALLOWED_MS) {
    const cycles = Math.floor(attempts / originalLength);

    if (attempts > 0) {
      read(0, layouts, boxes, originalLength);
      let firstX = boxes[0].x;
      for (let i = 0; i < originalLength; i++) {
        const box = boxes[i];
        const anchor = boxes[i + originalLength];
        box.x = i === originalLength - 1 ? firstX : boxes[i + 1].x;
        box.width *= (1 - cycles * 0.1);
        box.height *= (1 - cycles * 0.1);
        anchor.x = anchorX(box);
        anchor.y = anchorY(box);
      }
    }

    const layout = new Layout()
      .size([width, height])
      .avoidOverlaps(true)
      .nodes(boxes)
      .links(links)
      .constraints(constraints);

    for (let i = 0; i < MAX_LAYOUT_ITERATIONS; i++) {
      if (timer.elapsed > ALLOWED_MS) break;
      if (
        !step(
          layout,
          width,
          height,
          boxes,
          overrides,
          originalLength,
          restrictedIndex,
          restricted.length,
          layouts,
          valid,
        )
      ) continue;
      valid++;
      if (valid === MAX_VALID_LAYOUTS) break;
    }
    attempts++;
  }

  if (valid === 0) {
    console.error("no valid layouts");
  }
  else {
    timer.checkpoint("elapsed", true);
  }

  let bestIndex = 0; // read in original settings if no valid layout, meaning overlaps likely
  let bestCost = Infinity;
  for (let i = 0; i < valid; i++) {
    const cost = layoutCost(layouts, i, boxes, originalLength);
    if (cost >= bestCost) continue;
    bestCost = cost;
    bestIndex = i;
  }

  read(bestIndex, layouts, boxes, originalLength);

  for (let i = 0; i < originalLength; i++) {
    const box = boxes[i];
    box.left = left(box);
    box.top = top(box);
    restore(box);
    for (const key in box)
      if (!inputKeys.has(key)) delete (box as any)[key];
  }

  while (boxes.length > originalLength) boxes.pop();
}