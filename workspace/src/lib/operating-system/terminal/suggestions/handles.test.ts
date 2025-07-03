import { describe, it, expect } from "vitest";
import { sortHandlesHighToLow, tryGetOccupiedIndex } from "./handles.js";

describe(sortHandlesHighToLow.name, () => {
  it("should sort handles by top offset", () => {
    const handles = [
      { topOffset: 10 },
      { topOffset: 5 },
      { topOffset: 15 },
    ];
    const result = [...handles].sort(sortHandlesHighToLow);
    expect(result).toEqual([
      { topOffset: 15 },
      { topOffset: 10 },
      { topOffset: 5 },
    ]);
  });
});

describe(tryGetOccupiedIndex.name, () => {
  it("should find index when x is within a range in forward search", () => {
    const result = tryGetOccupiedIndex([[0, 10], [15, 25], [30, 40]], 5, 0, 1, "not found");
    expect(result).toBe(0);
  });

  it("should find index when x is within a range in backward search", () => {
    const result = tryGetOccupiedIndex([[0, 10], [15, 25], [30, 40]], 35, 2, -1, "not found");
    expect(result).toBe(2);
  });

  it("should return onFail when x is not in any range", () => {
    const result = tryGetOccupiedIndex([[0, 10], [15, 25]], 12, 0, 1, "not found");
    expect(result).toBe("not found");
  });

  it("should handle negative searchIndex by clamping to 0", () => {
    const result = tryGetOccupiedIndex([[5, 15]], 10, -5, 1, "not found");
    expect(result).toBe(0);
  });

  it("should work with empty occupied array", () => {
    const result = tryGetOccupiedIndex([], 5, 0, 1, "not found");
    expect(result).toBe("not found");
  });

  it("should handle zero direction search", () => {
    const result = tryGetOccupiedIndex([[0, 10], [15, 25]], 5, 0, 0, "not found");
    expect(result).toBe(0);
  });

  it("should handle different onFail types", () => {
    const result = tryGetOccupiedIndex([[0, 10]], 15, 0, 1, null);
    expect(result).toBe(null);
  });
});