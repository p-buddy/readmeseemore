import { Layout, type Node, type Link } from 'webcola';

type Center = Record<"x" | "y", number>;
type Rect = Center & Record<"width" | "height", number>;
type Horizontal = Pick<Rect, 'x' | 'width'>;
type Vertical = Pick<Rect, 'y' | 'height'>;

export type Entry = Rect & {
  targetX: number;
  fixed?: number;
};

const anchor = (x: number, y: number) =>
  ({ x, y, fixed: 1, width: 0, height: 0, targetX: -1 });

const left = ({ x, width }: Horizontal) => x - width / 2;
const right = ({ x, width }: Horizontal) => x + width / 2;
const top = ({ y, height }: Vertical) => y - height / 2;
const bottom = ({ y, height }: Vertical) => y + height / 2;

const overlapX = (a: Horizontal, b: Horizontal) =>
  Math.min(right(a), right(b)) - Math.max(left(a), left(b));

const overlapY = (a: Vertical, b: Vertical) =>
  Math.min(bottom(a), bottom(b)) - Math.max(top(a), top(b));

const overlaps = (a: Horizontal & Vertical, b: Horizontal & Vertical) =>
  overlapX(a, b) > 0 && overlapY(a, b) > 0;

const inBounds = (entry: Horizontal & Vertical, width: number, height: number) =>
  left(entry) >= 0 && right(entry) <= width && top(entry) >= 0 && bottom(entry) <= height;

const MAX_ITERATIONS = 10;
const MAX_VALID_LAYOUTS = 3;
const SERIALIZED_PROPERTIES = 2;
const SERIALIZED_LAYOUT_WIDTH = SERIALIZED_PROPERTIES * MAX_VALID_LAYOUTS;
const X_COST = 3;
const Y_COST = 1;

const write = (
  index: number, serialized: Float32Array, entries: Entry[], length: number
) => {
  const base = SERIALIZED_PROPERTIES * index * length;
  for (let i = 0; i < length; i++) {
    const off = base + i * SERIALIZED_PROPERTIES;
    serialized[off] = entries[i].x;
    serialized[off + 1] = entries[i].y;
  }
}

const read = (
  index: number, serialized: Float32Array, entries: Entry[], length: number
) => {
  const base = SERIALIZED_PROPERTIES * index * length;
  for (let i = 0; i < length; i++) {
    const off = base + i * SERIALIZED_PROPERTIES;
    entries[i].x = serialized[off];
    entries[i].y = serialized[off + 1];
  }
}

const cost = (entries: Entry[], pureEntriesLength: number) => {
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
  entries: Entry[],
  pureEntriesLength: number
) => {
  read(serializedIndex, serialized, entries, pureEntriesLength);
  return cost(entries, pureEntriesLength);
}

const step = (
  layout: Layout,
  width: number,
  height: number,
  entries: Entry[],
  pureEntriesLength: number,
  serialized: Float32Array,
  serializedIndex: number,
) => {
  layout.start(1, 1, 1);

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

export const computeLayout = (width: number, height: number, entries: Entry[]) => {
  if (entries.length === 0) return;

  entries.sort((a, b) => a.targetX - b.targetX);

  const originalLength = entries.length;

  for (let i = 0; i < originalLength; i++)
    entries.push(anchor(entries[i].targetX, height));

  const topLeft = { x: 0, y: 0, fixed: 1, width: 0, height: 0, targetX: -1 };
  const bottomRight = { x: width, y: height, fixed: 1, width: 0, height: 0, targetX: -1 };
  const topLeftIndex = entries.push(topLeft) - 1;
  const bottomRightIndex = entries.push(bottomRight) - 1;

  const constraints = Array<any>();
  const links: Link<Node>[] = [];
  for (let i = 0; i < originalLength; i++) {
    const entry = entries[i];
    const { width, height } = entry;
    const anchorIndex = i + originalLength;
    links.push({
      source: entry,
      target: entries[anchorIndex],
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
    .nodes(entries)
    .links(links)
    .constraints(constraints);

  const layouts = new Float32Array(originalLength * SERIALIZED_LAYOUT_WIDTH);

  let valid = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!step(layout, width, height, entries, originalLength, layouts, valid))
      continue;
    valid++;
    if (valid === MAX_VALID_LAYOUTS) break;
  }

  let bestIndex = -1;
  let bestCost = Infinity;
  for (let i = 0; i < valid; i++) {
    const cost = layoutCost(layouts, i, entries, originalLength);
    if (cost >= bestCost) continue;
    bestCost = cost;
    bestIndex = i;
  }

  read(bestIndex, layouts, entries, originalLength);
  entries.length = originalLength;
}

export const apply = (entry: Entry, { style }: HTMLElement, origin: DOMRect) => {
  style.left = `${entry.x - entry.width / 2 - origin.x}px`;
  style.bottom = `calc(100% + ${origin.y - (entry.y + entry.height / 2)}px)`;
}