import type { Point, Box } from "./types.js";

export function rectangleByPoints(p1: Point, p2: Point): Box {
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const width = Math.abs(p1.x - p2.x);
  const height = Math.abs(p1.y - p2.y);
  return { x, y, width: width, height: height };
}

export function rectanglesOverlap(r1: Box, r2: Box) {
  return !(
    r1.x + r1.width <= r2.x ||
    r1.y + r1.height <= r2.y ||
    r1.x >= r2.x + r2.width ||
    r1.y >= r2.y + r2.height
  );
}

export function simplifyPath(path: Point[]) {
  const simplified: Point[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (i === 0 || i === path.length - 1) {
      simplified.push(p);
    } else {
      const prev = path[i - 1]!;
      const next = path[i + 1]!;
      if (
        (prev.x === p.x && p.x === next.x) ||
        (prev.y === p.y && p.y === next.y)
      ) {
        continue;
      }
      simplified.push(p);
    }
  }
  return simplified;
}

// TODO: use more standardized way to generate unique IDs
export function generateId(prefix: string = ""): string {
  return `${prefix}${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export function isPointInAnyRectangle(
  point: Point,
  rectangles: Box[]
): boolean {
  return rectangles.some(
    (rect) =>
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
  );
}

export function isPointInBounds(point: Point, bounds: Box): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

export const snapToGrid = (value: number, gridSize: number = 10): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const snapPointToGrid = (point: { x: number; y: number }) => {
  return {
    x: snapToGrid(point.x),
    y: snapToGrid(point.y),
  };
};

export const defaults = {
  box: {
    width: 0 as const,
    height: 0 as const,
    x: 0 as const,
    y: 0 as const,
  } satisfies Box,
};
