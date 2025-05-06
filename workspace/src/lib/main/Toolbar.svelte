<script lang="ts">
  import type { driver as Driver, Popover } from "driver.js";
  import "driver.js/dist/driver.css";
  import Toolbar from "../toolbar/Toolbar.svelte";
  import type { WithElements, WithOperatingSystem } from "./index.js";

  let { elements, os }: Partial<WithElements & WithOperatingSystem> = $props();

  let driver: ReturnType<typeof Driver> | undefined;

  const highlight = async (element: HTMLElement, popover: Popover) => {
    driver ??= await import("driver.js").then(({ driver }) => driver());
    driver!.highlight({
      element,
      popover,
    });
  };
</script>

<Toolbar
  menus={[
    { content: "File", items: [] },
    {
      content: "View",
      items: [{ group: "Advanced" }],
    },
    {
      content: "Help",
      items: [
        {
          group: "UI Tour",
        },
        {
          content: "File Tree",
          onclick: () =>
            highlight(elements!.tree!, {
              title: "File Tree",
              side: "right",
              align: "center",
              description: "blah blah blah",
            }),
        },
        {
          content: "Terminals",
          onclick: () =>
            highlight(elements!.terminals!, {
              title: "Terminals",
              side: "top",
              align: "center",
              description: "blah blah blah",
            }),
        },
        {
          content: "Workspace",
          onclick: () => {},
        },
      ],
    },
  ]}
/>
