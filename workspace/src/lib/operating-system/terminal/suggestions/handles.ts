import type { Indexed } from "./common.svelte.js";
import { sortLeftToRight, type BoundingBox, type Range } from "./math.js";

export type Division = { x: number, top: number };

export type Handle = {
  index: number;
  left: number;
  right: number;
  topOffset: number;
  divisions: Division[];
}

const division = ({ left, width, top }: BoundingBox, originalLeft: number) =>
  ({ x: left + width / 2 - originalLeft, top } satisfies Division);

const overlaps = (a: Handle, b: Handle) =>
  a.left <= b.right && b.left <= a.right;

export const sortHandlesHighToLow = (a: Handle, b: Handle) =>
  b.topOffset - a.topOffset;

/**
 * Effectively marches along each handle (after sorting left to right),
 * and pushes up any neighbors that overlap it. 
 * @param handles 
 * @param offsetResolution 
 */
const preventOverlapsByOffsettingTop = (handles: Handle[], offsetResolution: number) => {
  handles.sort(sortLeftToRight);

  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i];
    for (let j = i + 1; j < handles.length; j++) {
      const other = handles[j];
      if (!overlaps(handle, other)) break;
      if (handle.topOffset !== other.topOffset) continue;
      other.topOffset += offsetResolution;
    }
  }
}

export const createNonOverlappingHandles = (
  indicators: Indexed<BoundingBox>[],
  annotationCount: number,
  verticalOffsetResolution: number
) => {
  type IndicatorCollection = Indexed<BoundingBox>[];
  const indicatorsPerAnnotation = new Array<IndicatorCollection>(annotationCount);

  for (let i = 0; i < indicators.length; i++)
    (indicatorsPerAnnotation[indicators[i].index] ??= []).push(indicators[i]);

  const minTopOffset = verticalOffsetResolution;

  const handles: Handle[] = indicatorsPerAnnotation.map(indicators => {
    indicators.sort(sortLeftToRight);
    const first = indicators[0];
    const last = indicators[indicators.length - 1];
    const left = first.left + first.width / 2;
    const right = last.left + last.width / 2;
    const divisions = indicators.map(indicator => division(indicator, left));
    return { index: first.index, left, right, divisions, topOffset: minTopOffset };
  });

  preventOverlapsByOffsettingTop(handles, verticalOffsetResolution);

  return handles;
}

export const occupyHorizontally = (occupied: Range[], { left, right }: Handle) => {
  if (occupied.length === 0) return occupied.push([left, right]);

  let index = occupied.length;
  for (let i = 0; i < occupied.length; ++i) {
    const [start] = occupied[i];
    if (start > left) {
      index = i;
      break;
    }
  }

  occupied.splice(index, 0, [left, right]);
  let mergeStart = Math.max(0, index - 1);

  let write = mergeStart;
  let [currentStart, currentEnd] = occupied[write];

  for (let read = write + 1; read < occupied.length; read++) {
    const [nextStart, nextEnd] = occupied[read];

    if (nextStart <= currentEnd) currentEnd = Math.max(currentEnd, nextEnd);
    else {
      occupied[write][0] = currentStart;
      occupied[write][1] = currentEnd;
      currentStart = nextStart;
      currentEnd = nextEnd;
      write += 1;
    }
  }

  occupied[write][0] = currentStart;
  occupied[write][1] = currentEnd;
  write += 1;

  if (write < occupied.length) occupied.splice(write, occupied.length - write);
}

const within = ([start, end]: Range, x: number) =>
  start <= x && x <= end;

export const tryGetOccupiedIndex = <OnFail>(
  occupied: Range[], x: number, searchIndex: number, searchDirection: number, onFail: OnFail
): number | OnFail => {
  for (let i = Math.max(0, searchIndex); i < occupied.length && i >= 0; i += Math.sign(searchDirection))
    if (within(occupied[i], x)) return i;
  return onFail;
}
