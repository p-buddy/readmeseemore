import type { Point } from "./types.js";

export const createSvgPath = (points: Point[], radius = 0) => {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (radius <= 0) {
    // Default to sharp corners
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }

  const pathParts: string[] = [];

  pathParts.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    // Vectors
    const v1x = curr.x - prev.x;
    const v1y = curr.y - prev.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;

    // Normalize vectors
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    const u1x = v1x / len1;
    const u1y = v1y / len1;
    const u2x = v2x / len2;
    const u2y = v2y / len2;

    // Adjust radius based on segment lengths
    // Use the minimum of the requested radius and half the shorter segment length
    const maxRadius = Math.min(len1, len2) / 2;
    const adjustedRadius = Math.min(radius, maxRadius);

    // Calculate entry and exit points for the rounded corner
    const startX = curr.x - u1x * adjustedRadius;
    const startY = curr.y - u1y * adjustedRadius;
    const endX = curr.x + u2x * adjustedRadius;
    const endY = curr.y + u2y * adjustedRadius;

    pathParts.push(`L ${startX} ${startY}`);
    pathParts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
  }

  // Final segment
  const last = points[points.length - 1];
  pathParts.push(`L ${last.x} ${last.y}`);

  return pathParts.join(" ");
}