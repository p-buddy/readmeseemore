import type { Indexed } from "./common.svelte.js";
import type { CommentBox } from "./comments.js";
import { occupyHorizontally, sortHandlesHighToLow, tryGetOccupiedIndex, type Division, type Handle } from "./handles.js";
import type { BoundingBox, Range } from "./math.js";

export type ConnectionPoint = Indexed<{ x: number, topOffset: number }>;

const boxOnTopOf = ({ left, width }: BoundingBox, x: number) =>
  left <= x && x <= left + width;

const isSingular = (handle: Handle) =>
  handle.divisions.length === 1;

const isTop = (handle: Handle, maxTopOffset: number) =>
  handle.topOffset === maxTopOffset;

type Rightward = 1;
type Leftward = -1;
type Direction = Rightward | Leftward;

const getEdgeX = (
  { left, right }: Pick<Handle, "left" | "right">, direction: Direction, edgePadding: number
) =>
  direction > 0 ? right - edgePadding : left + edgePadding;

const notPassedEdge = (
  x: number, handle: Pick<Handle, "left" | "right">, direction: Direction, edgePadding: number
) => direction * (getEdgeX(handle, direction, edgePadding) - x) >= 0

export type Padding = Record<"edge" | "division", number>;

const forwardBack = [1, -1] as const;
const backwardForward = [-1, 1] as const;
const searchDirections = (direction: Direction) =>
  direction === 1 ? forwardBack : backwardForward;

const tryFindUnoccupiedX = (
  handle: Pick<Handle, "left" | "right">,
  startX: number,
  startDirection: Direction,
  padding: Padding,
  occupied: Range[],
): number | false => {
  for (const direction of searchDirections(startDirection)) {
    let x = startX;
    let occupiedIndex = 0;
    while (notPassedEdge(x, handle, direction, padding.edge)) {
      occupiedIndex = tryGetOccupiedIndex(occupied, x, occupiedIndex, direction, -1);
      // TODO: The returned x could be less than padding.division away from an occupied region
      if (occupiedIndex === -1) return x;
      const occupiedBoundary = occupied[occupiedIndex][direction > 0 ? 1 : 0];
      x = occupiedBoundary + direction * padding.division;
    }
  }
  return false;
}

const tryFindXClearOfDivisionsAndConnectionPoints = (
  handle: Pick<Handle, "left" | "right">,
  startX: number,
  startDirection: Direction,
  padding: Padding,
  connectionPoints: ConnectionPoint[],
  handles: Handle[],
) => {
  const clear = (x: number, query: Pick<ConnectionPoint | Division, "x">) =>
    Math.abs(x - query.x) > padding.division;

  for (const direction of searchDirections(startDirection)) {
    let x = startX;
    while (notPassedEdge(x, handle, direction, padding.edge)) {
      let allClear = true
      for (let i = 0; i < connectionPoints.length; i++) {
        const point = connectionPoints[i];
        const handle = handles[i];
        if (!clear(x, point)) allClear = false;
        else
          for (const division of handle.divisions)
            if (!clear(x, division)) {
              allClear = false;
              break;
            }
      }
      if (allClear) return x;
      x += direction;
    }
  }
  return false;
}


export const findConnectionPoints = (
  comments: CommentBox[],
  handles: Handle[],
  verticalOffsetResolution: number,
  padding: Padding,
) => {
  handles.sort(sortHandlesHighToLow);
  const maxTopOffset = handles.at(-1)?.topOffset ?? verticalOffsetResolution;

  const commentByIndex = new Map(comments.map((comment, index) => [index, comment] as const));
  const occupied = new Array<[number, number]>();

  const connectionPoints = new Array<ConnectionPoint>();

  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i];
    const { index, right, left, topOffset } = handle;
    const centerX = (left + right) / 2;

    const comment = commentByIndex.get(index)!;
    const commentRight = comment.left + comment.width;
    const commentCenterX = (comment.left + commentRight) / 2;

    const dx = commentCenterX - centerX;
    const direction = Math.sign(dx) as Direction;

    let x = centerX;

    if (isSingular(handle)) { }
    else if (isTop(handle, maxTopOffset)) {
      if (!boxOnTopOf(comment, x))
        x = direction > 0
          ? Math.max(left + padding.edge, comment.left)
          : Math.min(right - padding.edge, commentRight);
    }
    else {
      const candidate = tryFindUnoccupiedX(handle, centerX, direction, padding, occupied);
      if (candidate !== false) x = candidate;
      else {
        const candidate = tryFindXClearOfDivisionsAndConnectionPoints(
          handle,
          centerX,
          direction,
          padding,
          connectionPoints,
          handles
        );
        if (candidate !== false) x = candidate;
        else x = centerX; // fallback
      }
    }

    connectionPoints.push({ x, index, topOffset })
    occupyHorizontally(occupied, handle);
  }

  return connectionPoints;
}