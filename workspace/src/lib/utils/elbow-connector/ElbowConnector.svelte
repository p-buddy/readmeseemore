<script lang="ts" module>
  import { createElbowConnector } from "./third-party/elbow-connector.js";

  type Rect = Pick<DOMRect, "x" | "y" | "width" | "height">;
  type Side = "top" | "right" | "bottom" | "left";
  type Edge = { side: Side; location: number };
  type RectAnchor = { rect: Rect; edge: Edge };
  type ElementAnchor = { element: HTMLElement } & Omit<RectAnchor, "rect">;

  type Props = {
    start: ElementAnchor;
    end: ElementAnchor;
    parent: HTMLElement;
    width?: number;
    smoothing?: number;
    class?: string;
    style?: string;
  };

  const getEdgePoint = (
    { x, y, width, height }: Rect,
    { side, location }: Edge,
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

  const slope = (p1: Point, p2: Point) => (p1.y - p2.y) / (p1.x - p2.x);
  const isHorizontal = (p1: Point, p2: Point) => slope(p1, p2) === 0;

  const nudgePointsTowardsAnchor = (
    rect: Rect,
    { side }: Edge,
    points: Point[],
    tail = false,
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

  const nudgeAlongEdge = (rect: Rect, { side }: Edge, amount: number = 0.1) =>
    side === "top" || side === "bottom"
      ? (rect.y += amount)
      : (rect.x += amount);

  const tryCreateAndNudge = (
    startPoint: Point,
    endPoint: Point,
    startRect: Rect,
    endRect: Rect,
    startEdge: Edge,
    endEdge: Edge,
  ) => {
    const args = [startPoint, endPoint, startRect, endRect, 5] as const;
    let points = createElbowConnector(...args);
    let attempts = 0;
    const nudge = 0.1;
    while (points.length <= 1 && attempts < 4) {
      if (attempts === 0) nudgeAlongEdge(startRect, startEdge, nudge);
      else if (attempts === 1) nudgeAlongEdge(endRect, endEdge, nudge);
      else if (attempts === 2) nudgeAlongEdge(startRect, startEdge, -nudge);
      else if (attempts === 3) nudgeAlongEdge(endRect, endEdge, -nudge);
      points = createElbowConnector(...args);
      attempts++;
    }
    return points;
  };

  export const connect = (start: ElementAnchor, end: ElementAnchor) => {
    const startRect = start.element.getBoundingClientRect();
    const endRect = end.element.getBoundingClientRect();
    const startPoint = getEdgePoint(startRect, start.edge);
    const endPoint = getEdgePoint(endRect, end.edge);
    const points = tryCreateAndNudge(
      startPoint,
      endPoint,
      startRect,
      endRect,
      start.edge,
      end.edge,
    );
    const { length } = points;
    if (length <= 1) throw new Error("No points to connect");
    nudgePointsTowardsAnchor(startRect, start.edge, points);
    nudgePointsTowardsAnchor(endRect, end.edge, points, true);
    return points;
  };

  const toHalfPixel = {
    round: (value: number) => Math.round(value * 2) / 2,
    ceil: (value: number) => Math.ceil(value * 2) / 2,
    floor: (value: number) => Math.floor(value * 2) / 2,
  };
</script>

<script lang="ts">
  import { createSvgPath } from "./third-party/svg.js";
  import type { Point } from "./third-party/types.js";

  let {
    start,
    end,
    parent,
    smoothing = 0,
    width = 3,
    ...rest
  }: Props = $props();

  const origin = $derived(parent.getBoundingClientRect());
  const path = $derived(connect(start, end));

  const bounding = $derived.by(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of path) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    return {
      x: toHalfPixel.floor(minX - 1),
      y: toHalfPixel.floor(minY - 1),
      width: toHalfPixel.ceil(maxX - minX + 2),
      height: toHalfPixel.ceil(maxY - minY + 2),
    };
  });

  const localCoordinates = $derived(
    path.map(({ x, y }) => ({
      x: toHalfPixel.round(x - bounding.x),
      y: toHalfPixel.round(y - bounding.y),
    })),
  );
</script>

<div
  {...rest}
  style:position="absolute"
  style:width={`${bounding.width}px`}
  style:height={`${bounding.height}px`}
  style:left={`${bounding.x - origin.x}px`}
  style:top={`${bounding.y - origin.y}px`}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="100%"
    height="100%"
    viewBox={`0 0 ${bounding.width} ${bounding.height}`}
  >
    <path
      d={createSvgPath(localCoordinates, smoothing)}
      stroke-linecap="butt"
      stroke-width={width}
      stroke="currentColor"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</div>
