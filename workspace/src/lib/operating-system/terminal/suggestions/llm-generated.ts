import { type createElbowConnector, } from "$lib/utils/elbow-connector/index.js";
import type { BoundingBox, } from "./math.js";

interface Rect {
  x: number;      // center X
  y: number;      // center Y
  width: number;
  height: number;
}

/** 
 * Return true iff rectA and rectB (both given by center + size) overlap.
 */
function rectsOverlapCentered(A: Rect, B: Rect): boolean {
  const halfW_A = A.width / 2;
  const halfH_A = A.height / 2;
  const halfW_B = B.width / 2;
  const halfH_B = B.height / 2;

  const dx = Math.abs(A.x - B.x);
  const dy = Math.abs(A.y - B.y);

  return dx < (halfW_A + halfW_B) && dy < (halfH_A + halfH_B);
}

export function inPlaceResolveOverlapAndKeepInBounds(
  rectA: Rect,       // movable
  rectB: Readonly<Rect>,       // fixed
  frameW: number,
  frameH: number,
): void {
  // 1) Precompute half-sizes and center-deltas:
  const halfW_A = rectA.width / 2;
  const halfH_A = rectA.height / 2;
  const halfW_B = rectB.width / 2;
  const halfH_B = rectB.height / 2;

  const dx = rectA.x - rectB.x;   // signed horizontal offset
  const dy = rectA.y - rectB.y;   // signed vertical offset

  // 2) How much do they overlap on each axis?
  //    If positive → overlap, if ≤ 0 → no overlap on that axis.
  const overlapX = (halfW_A + halfW_B) - Math.abs(dx);
  const overlapY = (halfH_A + halfH_B) - Math.abs(dy);

  // First, clamp rectA’s original center to make sure it's at least inside the frame:
  let origX = Math.max(halfW_A, Math.min(frameW - halfW_A, rectA.x));
  let origY = Math.max(halfH_A, Math.min(frameH - halfH_A, rectA.y));

  // If there's no overlap to begin with, simply return the clamped center:
  if (!(overlapX > 0 && overlapY > 0)) {
    rectA.x = origX;
    rectA.y = origY;
  }

  // 3) We know they overlap in both axes.  Build a list of axis candidates sorted by penetration:
  type AxisCandidate = {
    axis: "x" | "y";
    penetration: number;
  };
  const candidates: AxisCandidate[] = [
    { axis: "x", penetration: overlapX } as const,
    { axis: "y", penetration: overlapY } as const,
  ].sort((a, b) => a.penetration - b.penetration);

  // 4) Helper: clamp a centerX/centerY to stay in frame
  function clampCenter(cx: number, cy: number): { cx: number; cy: number } {
    const clampedX = Math.max(halfW_A, Math.min(frameW - halfW_A, cx));
    const clampedY = Math.max(halfH_A, Math.min(frameH - halfH_A, cy));
    return { cx: clampedX, cy: clampedY };
  }

  // 5) For each axis (in ascending order of penetration), attempt “shift→clamp→test overlap”:
  let bestFallback: {
    distFromOverlap: number;
    cx: number;
    cy: number;
  } = { distFromOverlap: -Infinity, cx: origX, cy: origY };

  for (const candidate of candidates) {
    let testX = origX;
    let testY = origY;

    if (candidate.axis === "x") {
      // push exactly overlapX in the sign of dx
      const shift = (dx > 0 ? +overlapX : -overlapX);
      testX = origX + shift;
    } else {
      // push exactly overlapY in the sign of dy
      const shift = (dy > 0 ? +overlapY : -overlapY);
      testY = origY + shift;
    }

    // clamp that test position inside the frame
    const { cx, cy } = clampCenter(testX, testY);

    // build a temporary rectA to check overlap
    const trialRect: Rect = {
      x: cx,
      y: cy,
      width: rectA.width,
      height: rectA.height
    };

    if (!rectsOverlapCentered(trialRect, rectB)) {
      // Success: we found a non‐overlapping, in‐bounds placement along this axis.
      rectA.x = cx;
      rectA.y = cy;
      return;
    }

    // If we’re here, clamping “undid” enough of the shift that we still overlap.
    // As a fallback metric, measure how far this (cx,cy) got us “away” from overlap:
    // We can approximate by measuring the signed distance along this axis between centers AFTER clamping,
    // minus the sum of half-sizes.  The bigger that gap, the “less overlap” remains.
    if (candidate.axis === "x") {
      const signedDX_afterClamp = cx - rectB.x;
      const gapX = Math.abs(signedDX_afterClamp) - (halfW_A + halfW_B);
      if (gapX > bestFallback.distFromOverlap) {
        bestFallback = { distFromOverlap: gapX, cx, cy };
      }
    } else {
      const signedDY_afterClamp = cy - rectB.y;
      const gapY = Math.abs(signedDY_afterClamp) - (halfH_A + halfH_B);
      if (gapY > bestFallback.distFromOverlap) {
        bestFallback = { distFromOverlap: gapY, cx, cy };
      }
    }
    // (Then we move on to try the next axis.)
  }

  // 6) If we reach here, **neither** axis‐resolution produced a fully disjoint placement.  
  //    That means the fixed rect “blocks” so much of the frame along both axes
  //    that even pushing right/left or up/down—then clamping—still left some overlap.
  //    We’ll return whichever clamped shift left us “least overlapped” (the bestFallback).
  rectA.x = bestFallback.cx;
  rectA.y = bestFallback.cy;
}


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