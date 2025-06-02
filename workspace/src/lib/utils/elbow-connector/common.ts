import type { NotOptionalIf } from "../index.js";
import { createElbowConnector } from "./third-party/elbow-connector.js";
import type { Point } from "./third-party/types.js";

export type Rect = Pick<DOMRect, "x" | "y" | "width" | "height">;
export type Side = "top" | "right" | "bottom" | "left";
export type Anchor = { side: Side; location: number };

export const defaultGridSize = 5;

export const getEdgePoint = (
  { x, y, width, height }: Rect,
  { side, location }: Anchor,
) =>
  side === "top"
    ? { x: x + width * location, y }
    : side === "bottom"
      ? { x: x + width * location, y: y + height }
      : side === "right"
        ? { x: x + width, y: y + height * location }
        : side === "left"
          ? { x, y: y + height * location }
          : { x, y };


export const nudgeAlongEdge = (rect: Rect, { side }: Anchor, amount: number = 0.1) =>
  side === "top" || side === "bottom"
    ? (rect.y += amount)
    : (rect.x += amount);

export const tryCreateWithRetryAfterNudge = (
  startPoint: Point,
  endPoint: Point,
  startRect: Rect,
  endRect: Rect,
  startEdge: Anchor,
  endEdge: Anchor,
) => {
  let points = createElbowConnector(
    startPoint, endPoint, startRect, endRect, defaultGridSize
  );
  let attempts = 0;
  const nudge = 0.1;
  while (points.length <= 1 && attempts < 4) {
    if (attempts === 0) nudgeAlongEdge(startRect, startEdge, nudge);
    else if (attempts === 1) nudgeAlongEdge(endRect, endEdge, nudge);
    else if (attempts === 2) nudgeAlongEdge(startRect, startEdge, -nudge * 2);
    else if (attempts === 3) nudgeAlongEdge(endRect, endEdge, -nudge * 2);
    points = createElbowConnector(
      startPoint, endPoint, startRect, endRect, defaultGridSize
    );
    attempts++;
  }
  return points;
};

export const slope = (p1: Point, p2: Point) => (p1.y - p2.y) / (p1.x - p2.x);
export const isHorizontal = (p1: Point, p2: Point) => slope(p1, p2) === 0;

export const alignEdgePointsWithAnchor = (
  rect: Rect, { side }: Anchor, points: Point[], tail = false,
) => {
  const closer = tail ? points[points.length - 1] : points[0];
  const further = tail ? points[points.length - 2] : points[1];
  if (side === "top" || side === "bottom") {
    const { y, height } = rect;
    const targetY = side === "bottom" ? y + height : y;
    closer.y = targetY;
    if (isHorizontal(closer, further)) further.y = targetY;
  } else if (side === "right" || side === "left") {
    const { x, width } = rect;
    const targetX = side === "right" ? x + width : x;
    closer.x = targetX;
    if (!isHorizontal(closer, further)) further.x = targetX;
  }
};

export const anchors = {
  midTop: { side: "top", location: 0.5 },
  midBottom: { side: "bottom", location: 0.5 },
  midLeft: { side: "left", location: 0.5 },
  midRight: { side: "right", location: 0.5 },
  topLeft: { side: "top", location: 0 },
  topRight: { side: "top", location: 1 },
  bottomLeft: { side: "bottom", location: 0 },
  bottomRight: { side: "bottom", location: 1 },
} satisfies Record<string, Anchor>;

export const tryConnectElements = <ThrowsOnBadPath extends boolean = false>(
  startRect: Rect, endRect: Rect, startEdge: Anchor, endEdge: Anchor,
  throws: ThrowsOnBadPath = false as ThrowsOnBadPath,
): NotOptionalIf<Point[], ThrowsOnBadPath> => {
  const startPoint = getEdgePoint(startRect, startEdge);
  const endPoint = getEdgePoint(endRect, endEdge);
  const points = tryCreateWithRetryAfterNudge(
    startPoint, endPoint, startRect, endRect, startEdge, endEdge,
  );
  const { length } = points;
  if (length <= 1) {
    if (throws) throw new Error("No points to connect");
    else return undefined as NotOptionalIf<Point[], ThrowsOnBadPath>;
  }
  alignEdgePointsWithAnchor(startRect, startEdge, points);
  alignEdgePointsWithAnchor(endRect, endEdge, points, true);
  return points;
};