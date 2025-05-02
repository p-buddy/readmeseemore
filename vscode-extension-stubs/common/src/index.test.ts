import { describe, expect, test } from "vitest";
import { subset } from "./utils";
describe(subset.name, () => {
  test("basic", () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
      d: {
        e: 4,
        f: 5,
        g: 6,
      },
      h: {
        i: 7,
        j: 8
      }
    }
    expect(
      subset(obj, "a", "b", { d: ["e", "f"] })
    ).toEqual({ a: 1, b: 2, d: { e: 4, f: 5 } });
    expect(
      subset(obj, "a", "b", { h: ["i", "j"] })
    ).toEqual({ a: 1, b: 2, h: { i: 7, j: 8 } });
    expect(
      subset(obj, "a", "b", { h: ["i", "j"], d: ["e", "f"] })
    ).toEqual(
      { a: 1, b: 2, h: { i: 7, j: 8 }, d: { e: 4, f: 5 } }
    );
    expect(
      subset(obj, "a", "b", { h: ["i", "j"], d: ["e", "f"] })
    ).toEqual(
      subset(obj, "a", "b", { h: ["i", "j"] }, { d: ["e", "f"] })
    );
  });
})