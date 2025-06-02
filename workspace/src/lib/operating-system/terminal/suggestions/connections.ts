import { type createElbowConnector, type Rect, } from "$lib/utils/elbow-connector/index.js";
import type { BoundingBox, } from "./math.js";

type Polyline = ReturnType<typeof createElbowConnector>;

export const countPolylineIntersectionsWithBoxes = (
  polyline: Polyline, boxes: BoundingBox[], skipBox: number,
) => {
  const interesectedBoxes = new Set<number>();
  for (let i = 0; i < polyline.length - 1; ++i) {
    const { x: x1, y: y1 } = polyline[i];
    const { x: x2, y: y2 } = polyline[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    for (let b = 0; b < boxes.length; ++b) {
      if (b === skipBox) continue;
      if (interesectedBoxes.has(b)) continue;

      const { left, top, width, height } = boxes[b];
      const right = left + width;
      const bottom = top + height;

      if (
        (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) ||
        (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)
      ) {
        interesectedBoxes.add(b);
        continue;
      }

      if (
        Math.max(x1, x2) < left || Math.min(x1, x2) > right ||
        Math.max(y1, y2) < top || Math.min(y1, y2) > bottom
      ) {
        continue;
      }

      // Left edge (x = xMin)
      if (dx !== 0) {
        let t = (left - x1) / dx;
        if (t >= 0 && t <= 1) {
          const y = y1 + t * dy;
          if (y >= top && y <= bottom) {
            interesectedBoxes.add(b);
            continue;
          }
        }
        // Right edge (x = xMax)
        t = (right - x1) / dx;
        if (t >= 0 && t <= 1) {
          const y = y1 + t * dy;
          if (y >= top && y <= bottom) {
            interesectedBoxes.add(b);
            continue;
          }
        }
      }
      // Top edge (y = yMin)
      if (dy !== 0) {
        let t = (top - y1) / dy;
        if (t >= 0 && t <= 1) {
          const x = x1 + t * dx;
          if (x >= left && x <= right) {
            interesectedBoxes.add(b);
            continue;
          }
        }
        // Bottom edge (y = yMax)
        t = (bottom - y1) / dy;
        if (t >= 0 && t <= 1) {
          const x = x1 + t * dx;
          if (x >= left && x <= right) {
            interesectedBoxes.add(b);
            continue;
          }
        }
      }
    }
  }

  return interesectedBoxes.size;
}

export function rectify(box: BoundingBox | Rect): asserts box is Rect {
  (box as Rect).x = (box as BoundingBox).left;
  (box as Rect).y = (box as BoundingBox).top;
}