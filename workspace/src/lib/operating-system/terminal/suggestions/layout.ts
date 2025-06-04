import { Layout, type Node, type Link, type InputNode } from 'webcola';
import type { BoundingBox } from './math.js';
import type { Indexed } from './common.svelte.js';
import { Timer, type Prettify } from '$lib/utils/index.js';

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
    if (preserved(key)) {
      box[tempKey(key)] = box[key];
      delete box[key];
    }
}

const restore = (box: InputBox) => {
  for (const key in preserveKey)
    if (preserved(key)) box[key] = box[tempKey(key)];
}

const initForLayout = (box: InputBox | LayoutItem) => {
  const { left, top, width, height } = box as InputBox;
  preserve(box as InputBox);
  (box as LayoutItem).x = left + width / 2;
  (box as LayoutItem).y = top + height / 2;
}

function initAndAssert(boxes: (InputBox | LayoutItem)[]): asserts boxes is LayoutItem[] {
  for (let i = 0; i < boxes.length; i++) initForLayout(boxes[i] as InputBox);
}

const anchor = (x: number, y: number) =>
  ({ x, y, fixed: 1, width: 0, height: 0, targetX: -1 });

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

const MAX_ITERATIONS = 6;
const MAX_VALID_LAYOUTS = 2;
const SERIALIZED_PROPERTIES = 2;
const SERIALIZED_LAYOUT_WIDTH = SERIALIZED_PROPERTIES * MAX_VALID_LAYOUTS;
const X_COST = 3;
const Y_COST = 1;

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
  return cost(entries, pureEntriesLength);
}

const step = (
  layout: Layout,
  width: number,
  height: number,
  entries: LayoutItem[],
  pureEntriesLength: number,
  serialized: Float32Array,
  serializedIndex: number,
) => {
  // For some reason, (2, 2, 2) is the fastest configuration.
  layout.start(2, 2, 2);

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

  let valid = true;

  for (let i = 0; i < pureEntriesLength; i++) {
    entries[i].x += (nudgeRight - nudgeLeft);
    entries[i].y += (nudgeDown - nudgeUp);
    if (!inBounds(entries[i], width, height)) valid = false;
  }

  if (!valid) return false;

  for (let i = 0; i < pureEntriesLength; i++) {
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
  width: number, height: number, boxes: InputBox[]
) => {
  if (boxes.length <= 1) return;

  const timer = new Timer(false);

  boxes.sort((a, b) => a.left - b.left);

  const originalLength = boxes.length;

  initAndAssert(boxes);

  for (let i = 0; i < originalLength; i++)
    boxes.push(anchor(boxes[i].x, height));

  const topLeft = { x: 0, y: 0, fixed: 1, width: 0, height: 0, targetX: -1 };
  const bottomRight = { x: width, y: height, fixed: 1, width: 0, height: 0, targetX: -1 };
  const topLeftIndex = boxes.push(topLeft) - 1;
  const bottomRightIndex = boxes.push(bottomRight) - 1;

  const constraints = Array<any>();
  const links: Link<Node>[] = [];
  for (let i = 0; i < originalLength; i++) {
    const entry = boxes[i];
    const { width, height } = entry;
    const anchorIndex = i + originalLength;
    links.push({
      source: entry,
      target: boxes[anchorIndex],
      length: height / 2,
    });
    constraints.push({ axis: 'x', left: topLeftIndex, right: i, gap: width / 2 });
    constraints.push({ axis: 'y', left: topLeftIndex, right: i, gap: height / 2 });
    constraints.push({ axis: 'x', left: i, right: bottomRightIndex, gap: width / 2 });
    constraints.push({ axis: 'y', left: i, right: bottomRightIndex, gap: height / 2 });
  }

  const layout = new Layout()
    .size([width, height])
    .avoidOverlaps(true)
    .nodes(boxes)
    .links(links)
    .constraints(constraints);

  const layouts = new Float32Array(originalLength * SERIALIZED_LAYOUT_WIDTH);

  let valid = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (timer.elapsed > 200 && valid > 0) break;
    if (!step(layout, width, height, boxes, originalLength, layouts, valid))
      continue;
    valid++;
    if (valid === MAX_VALID_LAYOUTS) break;
  }

  let bestIndex = -1;
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