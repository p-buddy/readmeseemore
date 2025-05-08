import { test, expect, describe } from "vitest";
import { panelConfig } from "./dockview.js";
import type { Renderables, ViewAPI, ViewKey } from "@p-buddy/dockview-svelte";

describe(panelConfig.name, () => {
  test("basic", () => {
    const conf = panelConfig(null as any as ViewAPI<"grid", Renderables<"grid">>)
      .maximumHeight(100)
      .direction("above")
      .reference({ reference: "panel" })
      .minimumHeight(10)
      .options;

    expect(conf).toEqual({
      minimumHeight: 10,
      maximumHeight: 100,
      position: {
        direction: "above",
        referencePanel: "panel",
      },
    })
  })
})
