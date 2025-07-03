import { describe, it, expect } from "vitest";
import { findConnectionPoints, getEdgeX, notPassedEdge, type Padding } from "./connections.js";
import type { CommentBox } from "./comments.js";
import type { Handle, Division } from "./handles.js";

const createHandle = (
  index: number,
  left: number,
  right: number,
  topOffset: number,
  divisions: Division[] = []
): Handle => ({
  index,
  left,
  right,
  topOffset,
  divisions
});

const createComment = (
  index: number,
  left: number,
  width: number,
  top: number = 0,
  height: number = 20
): CommentBox => ({
  index,
  left,
  top,
  width,
  height
});

const createPadding = (edge: number = 5, division: number = 10): Padding => ({
  edge,
  division
});

describe(getEdgeX.name, () => {
  it("should return the correct x value (right)", () => {
    const handle = { left: 10, right: 30 };
    const direction = 1;
    const edgePadding = 5;
    const result = getEdgeX(handle, direction, edgePadding);
    expect(result).toBe(25);
  });

  it("should return the correct x value (left)", () => {
    const handle = { left: 10, right: 30 };
    const direction = -1;
    const edgePadding = 5;
    const result = getEdgeX(handle, direction, edgePadding);
    expect(result).toBe(15);
  });
});

describe(notPassedEdge.name, () => {
  it("should return true if the x value is not passed the edge", () => {
    const handle = { left: 10, right: 30 };
    const direction = 1;
    const edgePadding = 5;

    let i = handle.left + edgePadding;
    while (i <= handle.right - edgePadding) {
      const result = notPassedEdge(i, handle, direction, edgePadding);
      expect(result).toBe(true);
      i++;
    }
  });

  it("should return false if the x value is passed the edge (right)", () => {
    const handle = { left: 10, right: 30 };
    const direction = 1;
    const edgePadding = 5;
    const result = notPassedEdge(25.1, handle, direction, edgePadding);
    expect(result).toBe(false);
  });

  it("should return false if the x value is passed the edge (left)", () => {
    const handle = { left: 10, right: 30 };
    const direction = -1;
    const edgePadding = 5;
    const result = notPassedEdge(14.9, handle, direction, edgePadding);
    expect(result).toBe(false);
  });
});

describe(findConnectionPoints.name, () => {

  describe("basic functionality", () => {
    it("should return connection points for each handle", () => {
      const handles = [
        createHandle(0, 10, 30, 20),
        createHandle(1, 40, 60, 20)
      ];
      const comments = [
        createComment(0, 50, 20),
        createComment(1, 80, 20)
      ];
      const padding = createPadding();

      const result = findConnectionPoints(comments, handles, 10, padding);

      expect(result).toHaveLength(2);
      expect(result[0].index).toBe(0);
      expect(result[1].index).toBe(1);
    });
  });

  describe("boundary validation - x should be within handle bounds", () => {
    it("should ensure x is within handle bounds for top handles with comment not on top", () => {
      const handles = [
        createHandle(0, 10, 30, 20), // top handle
        createHandle(1, 40, 60, 10)  // lower handle
      ];
      const comments = [
        createComment(0, 50, 20), // comment to the right
        createComment(1, 80, 20)
      ];
      const padding = createPadding(5);

      const result = findConnectionPoints(comments, handles, 10, padding);

      // First handle should have x within bounds, accounting for edge padding
      expect(result[0].x).toBeGreaterThanOrEqual(10 + 5); // left + edge padding
      expect(result[0].x).toBeLessThanOrEqual(30 - 5);     // right - edge padding
    });
  });

  describe("edge cases that might cause boundary violations", () => {
    it("should handle multiple handles with overlapping occupied regions", () => {
      const handles = [
        createHandle(0, 10, 30, 20),
        createHandle(1, 15, 35, 10) // overlaps with first handle
      ];
      const comments = [
        createComment(0, 50, 20),
        createComment(1, 80, 20)
      ];
      const padding = createPadding(5, 10);

      const result = findConnectionPoints(comments, handles, 10, padding);

      // Both connection points should be within their respective handle bounds
      expect(result[0].x).toBeGreaterThanOrEqual(10 + 5);
      expect(result[0].x).toBeLessThanOrEqual(30 - 5);
      expect(result[1].x).toBeGreaterThanOrEqual(15 + 5);
      expect(result[1].x).toBeLessThanOrEqual(35 - 5);
    });
  });

  describe("complex scenarios", () => {
    it("should handle multiple handles with different top offsets", () => {
      const handles = [
        createHandle(0, 10, 30, 30), // highest
        createHandle(1, 40, 60, 20), // middle
        createHandle(2, 70, 90, 10)  // lowest
      ];
      const comments = [
        createComment(0, 50, 20),
        createComment(1, 80, 20),
        createComment(2, 110, 20)
      ];
      const padding = createPadding(5, 10);

      const result = findConnectionPoints(comments, handles, 10, padding);

      expect(result).toHaveLength(3);

      // All connection points should be within their handle bounds
      result.forEach((point, i) => {
        const handle = handles[i];
        expect(point.x).toBeGreaterThanOrEqual(handle.left + 5);
        expect(point.x).toBeLessThanOrEqual(handle.right - 5);
      });
    });

    it("should handle handles with divisions that might interfere with connection points", () => {
      const divisions1: Division[] = [{ x: 10, top: 10 }];
      const divisions2: Division[] = [{ x: 15, top: 10 }];

      const handles = [
        createHandle(0, 10, 30, 20, divisions1),
        createHandle(1, 40, 60, 10, divisions2)
      ];
      const comments = [
        createComment(0, 50, 20),
        createComment(1, 80, 20)
      ];
      const padding = createPadding(5, 10);

      const result = findConnectionPoints(comments, handles, 10, padding);

      expect(result).toHaveLength(2);

      // All connection points should be within their handle bounds
      result.forEach((point, i) => {
        const handle = handles[i];
        expect(point.x).toBeGreaterThanOrEqual(handle.left + 5);
        expect(point.x).toBeLessThanOrEqual(handle.right - 5);
      });
    });
  });
});