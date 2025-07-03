/// <reference lib="webworker" />
import { Timer, type LastIndex } from "$lib/utils/index.js";
import type { Indexed } from "./common.svelte.js";
import { findConnectionPoints, type Padding as ConnectionPadding, type ConnectionPoint } from "./connections.js";
import { computeLayoutInPlace as commentLayoutInPlace } from "./comments.js";
import type { BoundingBox } from "./math.js";
import { createNonOverlappingHandles } from "./handles.js";

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
  suggestionTop: number;
  comments: Indexed<BoundingBox>[];
  commentChildren: Indexed<BoundingBox>[];
  restricted: BoundingBox[];
  indicators: Indexed<BoundingBox>[];
  padding: ConnectionPadding
}


export type Output = [
  Input["comments"],
  Handle[],
  ConnectionPoint[],
  true
]

export type OutputIndex = keyof Output;
export type OutputElement = Output[OutputIndex];

const offsetResolution = 8;

export const computeLayout = (
  { width, height, comments, indicators, restricted, padding }: Input,
  send: <T extends OutputIndex>(index: T & number, data: Output[T]) => void
) => {
  const timer = new Timer(false);

  commentLayoutInPlace(width, height, comments, restricted);
  timer.checkpoint("comments");

  send(0, comments);

  const handles = createNonOverlappingHandles(indicators, comments.length, offsetResolution);
  timer.checkpoint("handles");

  send(1, handles);

  const connectionPoints = findConnectionPoints(comments, handles, offsetResolution, padding);
  timer.checkpoint("connection points");

  send(2, connectionPoints);

  send(3 satisfies LastIndex<Output>, true);
}

if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  postMessage(undefined);
  onmessage = ({ data }: MessageEvent<Input>) => {
    computeLayout(data, (_, data) => postMessage(data));
  };
}