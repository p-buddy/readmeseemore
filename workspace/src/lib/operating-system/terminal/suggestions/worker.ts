/// <reference lib="webworker" />
import { tryConnectElements, anchors, type Rect } from "$lib/utils/elbow-connector/index.js";
import { Timer, type LastIndex } from "$lib/utils/index.js";
import type { Indexed, Key } from "./common.svelte.js";
import { rectify } from "./connections.js";
import { computeLayoutInPlace } from "./layout.js";
import type { BoundingBox } from "./math.js";

type Path = ReturnType<typeof tryConnectElements>;
type BoundingRect = BoundingBox & Rect;
type Division = { x: number, top: number };

export type Handle = {
  index: number;
  left: number;
  right: number;
  topOffset: number;
  divisions: Division[];
}

export type Input = {
  width: number;
  height: number;
  comments: Indexed<BoundingBox>[];
  indicators: Indexed<BoundingBox>[];
}

export type Output = [
  Input["comments"],
  Handle[],
  true
]

export type OutputIndex = keyof Output;
export type OutputElement = Output[OutputIndex];

const rect = <T extends BoundingBox>(item: T) => (rectify(item), item);

const division = ({ left, width, top }: BoundingBox) =>
  ({ x: left + width / 2, top } satisfies Division);

const overlaps = (a: Handle, b: Handle) =>
  a.left <= b.right && b.left <= a.right;

const offsetResolution = 8;

export const computeLayout = (
  { width, height, comments, indicators }: Input,
  send: <T extends OutputIndex>(index: T & number, data: Output[T]) => void
) => {
  const timer = new Timer(true);

  computeLayoutInPlace(width, height, comments);
  timer.checkpoint("computeLayoutInPlace");

  send(0, comments);

  const { length } = comments;

  const indicatorsPerIndex = new Array<BoundingRect[]>(length);
  for (let i = 0; i < indicators.length; i++) {
    const { index } = indicators[i];
    (indicatorsPerIndex[index] ??= []).push(rect(indicators[i]));
  }

  timer.checkpoint("indicatorsPerIndex");

  let top = Number.MAX_SAFE_INTEGER;

  const handles = new Array<Handle>(length);
  for (let index = 0; index < length; index++) {
    const divisions: Handle["divisions"] = [];
    let left = Number.MAX_SAFE_INTEGER;
    let right = Number.MIN_SAFE_INTEGER;
    for (const bound of indicatorsPerIndex[index]) {
      const current = division(bound);
      left = Math.min(left, current.x);
      right = Math.max(right, current.x);
      top = Math.min(top, current.top);
      divisions.push(current);
    }
    divisions.sort((a, b) => a.x - b.x);
    for (const division of divisions) division.x = division.x - left;
    handles[index] = { index, left, right, divisions, topOffset: offsetResolution };
  }

  timer.checkpoint("handles");

  handles.sort((a, b) => a.left - b.left);

  for (let i = 0; i < length; i++) {
    const handle = handles[i];
    for (let j = i + 1; j < length; j++) {
      const other = handles[j];
      if (!overlaps(handle, other)) break;
      if (handle.topOffset !== other.topOffset) continue;
      other.topOffset += offsetResolution;
    }
  }

  timer.checkpoint("overlaps");

  send(1, handles);

  send(2 satisfies LastIndex<Output>, true);
}

if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  postMessage(undefined);
  onmessage = ({ data }: MessageEvent<Input>) => {
    computeLayout(data, (_, data) => postMessage(data));
  };
}