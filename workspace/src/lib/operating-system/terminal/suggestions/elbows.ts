import { route, Rectangle } from "@blocksuite/connector";
import type { BoundingBox } from "./math.js";
import type { ConnectionPoint, Padding as ConnectionPadding } from "./connections.js";
import type { Indexed } from "./common.svelte.js";
import type { Maybe } from "$lib/utils/index.js";

const boxToRect = ({ left, top, width, height }: BoundingBox) =>
  new Rectangle(left, top, width, height);

const point = (x: number, y: number) => ({ x, y });
type Point = ReturnType<typeof point>;

const distanceFrom = (start: Point, end: Point) => {
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

const sortByDistance = (target: Point, a: Point, b: Point) =>
  distanceFrom(target, a) - distanceFrom(target, b);

type CommentChild = Indexed<BoundingBox>;
type CommentChildByIndex = Map<CommentChild["index"], CommentChild>;

const dotRectanglesAlongPath = (
  path: Point[], rectangles: Rectangle[],
) => {
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    // Assumes straight line segments
    const length = deltaY === 0 ? deltaX : deltaY;
  }
}

const tryCalculateRoutes = (
  connectionPoints: ConnectionPoint[],
  commentChildByIndex: CommentChildByIndex,
  rectangles: Rectangle[],
  padding: Pick<ConnectionPadding, "edge">,
  suggestionTop: number,
  elbowStartFloor: number,
  pathPadding = 2
) => {
  const result = new Array<Point[]>(connectionPoints.length);
  const originalRectangleLength = rectangles.length;

  for (const { x, index, topOffset } of connectionPoints) {
    const child = commentChildByIndex.get(index)!;
    const points = [
      point(x, suggestionTop - topOffset),
      point(x, elbowStartFloor)
    ];

    const candidates = [
      /* Top Edge */
      point(child.left + padding.edge, child.top),
      point(child.left + child.width / 2, child.top),
      point(child.left + child.width - padding.edge, child.top),
      /* Bottom Edge */
      point(child.left + padding.edge, child.top + child.height),
      point(child.left + child.width / 2, child.top + child.height),
      point(child.left + child.width - padding.edge, child.top + child.height),
      /* Left Edge */
      point(child.left, child.top + padding.edge),
      point(child.left, child.top + child.height / 2),
      point(child.left, child.top + child.height - padding.edge),
      /* Right Edge */
      point(child.left + child.width, child.top + padding.edge),
      point(child.left + child.width, child.top + child.height / 2),
      point(child.left + child.width, child.top + child.height - padding.edge),
    ];

    candidates.sort((a, b) => sortByDistance(points[1], a, b));

    let path: Maybe<ReturnType<typeof route>>;
    for (const candidate of candidates) {
      points.push(candidate);
      path = route(rectangles, points);
      points.pop();
      if (path.length > 0) break;
    }

    if (!path) {
      rectangles.splice(originalRectangleLength, rectangles.length - originalRectangleLength);
      return undefined;
    }

    result[index] = path.map(({ x, y }) => ({ x, y }));
    for (let i = 0; i < path.length - 1; i++) {
      const start = path[i];
      const end = path[i + 1];
      const minX = Math.min(start.x, end.y);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);
      rectangles.push(
        new Rectangle(
          minX - pathPadding,
          minY - pathPadding,
          maxX - minX + pathPadding,
          maxY - minY + pathPadding
        )
      );
    }
  }

  return result;
}

export const x = (
  commentChildren: Indexed<BoundingBox>[],
  width: number,
  height: number,
  restricted: BoundingBox[],
  connectionPoints: ConnectionPoint[],
  padding: Pick<ConnectionPadding, "edge">,
  suggestionTop: number,
  elbowStartFloor: number,
) => {
  const rectangles = commentChildren.map(boxToRect);
  rectangles.push(...restricted.map(boxToRect));
  rectangles.push(new Rectangle(0, -1, width, 1));
  rectangles.push(new Rectangle(0, height, width, 1));
  rectangles.push(new Rectangle(-1, 0, 1, height));
  rectangles.push(new Rectangle(width, 0, 1, height));

  type CommentChild = (typeof commentChildren)[number];
  const commentChildByIndex = commentChildren.reduce(
    (acc, child) => acc.set(child.index, child),
    new Map<CommentChild["index"], CommentChild>
  );

  let routes = tryCalculateRoutes(
    connectionPoints,
    commentChildByIndex,
    rectangles,
    padding,
    suggestionTop,
    elbowStartFloor
  );
  if (routes) return routes;

  connectionPoints.reverse();
  routes = tryCalculateRoutes(
    connectionPoints,
    commentChildByIndex,
    rectangles,
    padding,
    suggestionTop,
    elbowStartFloor
  )
}