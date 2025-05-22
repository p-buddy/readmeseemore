import type { Point, Box } from "./types.js";
import {
  isPointInAnyRectangle,
  isPointInBounds,
  rectangleByPoints,
  rectanglesOverlap,
  simplifyPath,
  snapPointToGrid,
} from "./utils.js";

const directions = (gridSize: number) => [
  { x: 0, y: -gridSize }, // Up
  { x: gridSize, y: 0 }, // Right
  { x: 0, y: gridSize }, // Down
  { x: -gridSize, y: 0 }, // Left
];

const defaultGridSize = 10;

const pointKey = (point: Point) => `${point.x},${point.y}`;

function balancePath(path: Point[], rect1: Box, rect2: Box) {
  let x1, x2, y1, y2;
  if (rect1.x + rect1.width < rect2.x) {
    x1 = rect1.x + rect1.width;
    x2 = rect2.x;
  } else if (rect2.x + rect2.width < rect1.x) {
    x1 = rect2.x + rect2.width;
    x2 = rect1.x;
  }

  if (rect1.y + rect1.height < rect2.y) {
    y1 = rect1.y + rect1.height;
    y2 = rect2.y;
  } else if (rect2.y + rect2.height < rect1.y) {
    y1 = rect2.y + rect2.height;
    y2 = rect1.y;
  }

  let balanced = false;
  if (x1 && x2) {
    const points = path
      .map((p, i) => ({ x: p.x, y: p.y, i }))
      .filter((p) => p.x > x1 && p.x < x2);
    if (points.length === 2) {
      const s = path[points[0]!.i - 1];
      const e = path[points[1]!.i + 1];
      if (s && e) {
        path[points[0]!.i] = {
          x: s.x + (e.x - s.x) / 2,
          y: points[0]!.y,
        };
        path[points[1]!.i] = {
          x: s.x + (e.x - s.x) / 2,
          y: points[1]!.y,
        };
        balanced = true;
      }
    }
  }

  if (y1 && y2 && !balanced) {
    const points = path
      .map((p, i) => ({ x: p.x, y: p.y, i }))
      .filter((p) => p.y > y1 && p.y < y2);
    if (points.length === 2) {
      const s = path[points[0]!.i - 1];
      const e = path[points[1]!.i + 1];
      if (s && e) {
        path[points[0]!.i] = {
          x: points[0]!.x,
          y: s.y + (e.y - s.y) / 2,
        };
        path[points[1]!.i] = {
          x: points[1]!.x,
          y: s.y + (e.y - s.y) / 2,
        };
      }
    }
  }

  return path;
}

interface Node {
  point: Point;
  direction: number | null;
  turns: number;
  path: Point[];
}

function findPath(
  bounds: Box,
  p1: Point,
  p2: Point,
  rectangles: Box[],
  gridSize: number,
): Point[] {
  const start = snapPointToGrid(p1);
  const end = snapPointToGrid(p2);

  const startNode: Node = {
    point: start,
    direction: null,
    turns: 0,
    path: [start],
  };
  const queue: Node[] = [startNode];
  const visited = new Map<string, { turns: number }>();

  const dirs = directions(gridSize);

  while (queue.length > 0) {
    queue.sort((a, b) => {
      if (a.path.length !== b.path.length) {
        return a.path.length - b.path.length;
      }
      return a.turns - b.turns;
    });

    const current = queue.shift()!;

    if (current.point.x === end.x && current.point.y === end.y) {
      return current.path;
    }

    for (let dir = 0; dir < dirs.length; dir++) {
      const move = dirs[dir]!;
      const nextPoint: Point = {
        x: current.point.x + move.x,
        y: current.point.y + move.y,
      };

      const key = pointKey(nextPoint);
      const turns =
        current.direction === null || current.direction === dir
          ? current.turns
          : current.turns + 1;

      if (
        !isPointInBounds(nextPoint, bounds) ||
        (isPointInAnyRectangle(nextPoint, rectangles) &&
          !(nextPoint.x === end.x && nextPoint.y === end.y))
      ) {
        continue;
      }

      if (!visited.has(key) || visited.get(key)!.turns > turns) {
        visited.set(key, { turns });
        queue.push({
          point: nextPoint,
          direction: dir,
          turns: turns,
          path: [...current.path, nextPoint],
        });
      }
    }
  }

  return [];
}

function createElbowPath(p1: Point, p2: Point) {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);

  if (dx >= dy) {
    const x = (p1.x + p2.x) / 2;
    return [p1, { x, y: p1.y }, { x, y: p2.y }, p2];
  } else {
    const y = (p1.y + p2.y) / 2;
    return [p1, { x: p1.x, y }, { x: p2.x, y }, p2];
  }
}

export function createElbowConnector(
  p1: Point,
  p2: Point,
  rect1?: Box,
  rect2?: Box,
  gridSize: number = defaultGridSize,
) {
  if (rect1) {
    if (rect2) {
      return _createElbowConnector(p1, p2, rect1, rect2, gridSize);
    } else {
      return _createElbowConnector(p1, p2, rect1, undefined, gridSize);
    }
  } else {
    if (rect2) {
      return _createElbowConnector(p2, p1, rect2, undefined, gridSize);
    } else {
      return createElbowPath(p1, p2);
    }
  }
}

function _createElbowConnector(p1: Point, p2: Point, rect1: Box, rect2: Box | undefined, gridSize: number) {
  if (!rect2 && !rectanglesOverlap(rect1, rectangleByPoints(p1, p2))) {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);

    const width = gridSize * 2;
    const height = gridSize * 2;
    if (dx >= dy) {
      rect2 = {
        x: p2.x + (p2.x > p1.x ? 0 : -width),
        y: p2.y - height / 2,
        width: width,
        height: height,
      };
    } else {
      rect2 = {
        x: p2.x - width / 2,
        y: p2.y + (p2.y > p1.y ? 0 : -height),
        width: dx,
        height: gridSize,
      };
    }
  }

  const minX = Math.min(rect1.x, rect2 ? rect2.x : p2.x);
  const minY = Math.min(rect1.y, rect2 ? rect2.y : p2.y);
  const maxX = Math.max(rect1.x + rect1.width, rect2 ? rect2.x + rect2.width : p2.x);
  const maxY = Math.max(rect1.y + rect1.height, rect2 ? rect2.y + rect2.height : p2.y);

  const bounds = {
    x: minX - gridSize,
    y: minY - gridSize,
    width: maxX - minX + gridSize * 2,
    height: maxY - minY + gridSize * 2,
  };

  let path = findPath(bounds, p1, p2, rect2 ? [rect1, rect2] : [rect1], gridSize);
  path = simplifyPath(path);
  if (rect2) {
    path = balancePath(path, rect1, rect2);
  }

  return path;
}