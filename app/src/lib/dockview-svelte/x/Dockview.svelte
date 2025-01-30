<script module lang="ts">
  import {
    DockviewComponent,
    DockviewApi,
    GridviewApi,
    SplitviewApi,
    PaneviewApi,
    PROPERTY_KEYS_GRIDVIEW,
  } from "dockview-core";

  class SvelteContentRenderer implements IContentRenderer {}
</script>

<script>
  // Svelte 5 features
  import { onMount, onDestroy } from "svelte";
  // The main Dockview API

  let {
    // callback for the "ready" event
    onReady = () => {},

    // additional props akin to your old "VueProps"
    watermarkComponent,
    defaultTabComponent,
    leftHeaderActionsComponent,
    rightHeaderActionsComponent,
    prefixHeaderActionsComponent,

    // everything else (the DockviewOptions) goes in “rest”
    ...rest
  } = $props();

  /**
   * We'll store a reference to the DOM element (where Dockview will attach)
   * and the actual DockviewComponent instance.
   */
  let containerEl = $state();
  let dockviewInstance = $state();

  /**
   * Because Svelte 5 reactivity can be triggered by property reads, we can
   * write a little $: block for each property that we know Dockview can update:
   */

  PROPERTY_KEYS.forEach((key) => {
    $effect(() => {
      if (dockviewInstance && rest[key] !== undefined) {
        dockviewInstance.updateOptions({ [key]: rest[key] });
      }
    });
  });

  /**
   * During onMount, we create the DockviewComponent. We'll build up
   * a "frameworkOptions" object for the "createComponent", "createTabComponent",
   * etc. calls. Svelte doesn't require watchers like Vue does; we can set them
   * once.
   */
  onMount(() => {
    if (!containerEl) {
      throw new Error("No container element found");
    }

    const frameworkOptions = {
      parentElement: containerEl,

      // The Svelte equivalent of your `createComponent` from Vue might
      // be something like “Look up a Svelte child to render.” For brevity,
      // we omit the full code. In practice you'd do something like
      // create a Svelte dynamic component or your own “SvelteContentRenderer”.
      createComponent(options) {
        // TODO: your logic to find/instantiate a Svelte child
        console.warn("createComponent unimplemented in this sample");
        return null;
      },

      // Similarly for createTabComponent:
      createTabComponent(options) {
        console.warn("createTabComponent unimplemented in this sample");
        return null;
      },

      createWatermarkComponent: watermarkComponent
        ? () => {
            console.warn("createWatermarkComponent unimplemented");
            return null;
          }
        : undefined,

      createLeftHeaderActionComponent: leftHeaderActionsComponent
        ? (group) => {
            console.warn("createLeftHeaderAction unimplemented");
            return null;
          }
        : undefined,

      createPrefixHeaderActionComponent: prefixHeaderActionsComponent
        ? (group) => {
            console.warn("createPrefixHeaderAction unimplemented");
            return null;
          }
        : undefined,

      createRightHeaderActionComponent: rightHeaderActionsComponent
        ? (group) => {
            console.warn("createRightHeaderAction unimplemented");
            return null;
          }
        : undefined,
    };

    // Construct the Dockview instance
    dockviewInstance = new DockviewComponent({
      ...rest,
      ...frameworkOptions,
    });

    // Usually you'd want to do an initial layout:
    const { clientWidth, clientHeight } = containerEl;
    dockviewInstance.layout(clientWidth, clientHeight);

    // Fire "ready" event callback
    onReady({ api: new DockviewApi(dockviewInstance) });
  });

  // Tidy up on unmount
  onDestroy(() => {
    dockviewInstance?.dispose();
  });
</script>

<!-- The DOM container for Dockview -->
<div bind:this={containerEl} style="width:100%; height:100%;" />
