import type { ViewAPI, AddedPanelByView, ViewKey, Renderables, WithViewOnReady } from "@p-buddy/dockview-svelte";

export type ViewHelper<Type extends ViewKey, Views extends Renderables<Type>> = {
  api: ViewAPI<Type, Views>;
} & WithViewOnReady<Type, Views>;

export type ViewConfig<Type extends ViewKey, Views extends Renderables<Type>> = {
  type: Type;
} & Views;

export type ViewsHelper<T extends Record<string, { type: ViewKey } | Renderables<ViewKey>>> = {
  [K in keyof T]:
  T[K]["type"] extends ViewKey
  /**/ ? Omit<T[K], "type"> extends Renderables<T[K]["type"]>
    /**/ ? ViewHelper<T[K]["type"], Omit<T[K], "type">>
    /**/ : never
  /**/ : never;
}

type TryGet<Key extends string, T> = Key extends keyof T ? Exclude<T[Key], undefined> : never;

type Chainable<T, TReturn = never> = {
  [K in keyof T]-?: (value: T[K]) =>
    TReturn extends never
    ? Chainable<T>
    : Chainable<T, TReturn> & TReturn;
};

export const panelConfig = <T extends ViewKey, API extends ViewAPI<T, Renderables<T>> = ViewAPI<T, Renderables<T>>>(api?: API) => {
  type ExtractConfigParameter<Key extends string> = TryGet<Key, API> extends (...args: infer Args) => any
    ? Args[2]
    : never;
  type ConfigParameter = Exclude<
    ExtractConfigParameter<"addSnippetPanel"> & ExtractConfigParameter<"addComponentPanel">,
    undefined
  >;
  type Position = TryGet<"position", ConfigParameter>;
  type Reference = TryGet<"referencePanel", Position>;

  type WithReference<T = any> = { reference: T }

  type Customized = {
    direction: (direction: TryGet<"direction", Position>) => Customized & Chainable<ConfigParameter, Customized>;
    reference: (reference: Reference | WithReference<Reference>) => Customized & Chainable<ConfigParameter, Customized>;
    get options(): Exclude<ConfigParameter, undefined>;
  }

  let options = {} as Record<string, any>;

  const proxy = new Proxy({}, {
    get(_, prop) {
      switch (prop as keyof Customized) {
        case "direction":
          return ((direction) => {
            options["position"] ??= {};
            options["position"]["direction"] = direction;
            return proxy;
          }) satisfies Customized["direction"];
        case "reference":
          return ((reference) => {
            options["position"] ??= {};
            options["position"]["referencePanel"] =
              typeof reference === "string"
                ? reference
                : (reference as WithReference).reference;
            return proxy;
          }) satisfies Customized["reference"];
        case "options":
          return options;
        default:
          return (setting: any) => {
            options[prop as string] = setting;
            return proxy;
          }
      }
    }
  }) as (Chainable<ConfigParameter, Customized> & Customized);

  return proxy;
}

export const defaultDuration = 500;

export function animateSize(
  { api }: AddedPanelByView<"grid">,
  dimension: "width" | "height",
  { from, to, onComplete, duration = defaultDuration }: {
    from: number,
    to: number,
    onComplete?: () => void,
    duration?: number,
  },
) {
  const start = performance.now();
  function frame(now: number) {
    const t = Math.min((now - start) / duration, 1);
    const easeInOut = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const eased = easeInOut * easeInOut * (3 - 2 * easeInOut);
    api.setSize({ [dimension]: from + (to - from) * eased });
    if (t < 1) requestAnimationFrame(frame);
    else onComplete?.();
  }
  requestAnimationFrame(frame);
}

export const animateEntry = (
  { panels, width }: ViewAPI<"grid", any>,
  { id }: AddedPanelByView<"grid">
) => {
  const entryWidth = width / panels.length;
  for (const panel of panels) {
    const isEntering = panel.id === id;
    const from = isEntering ? 0 : panel.width;
    const to = isEntering ? entryWidth : (panel.width / width) * (width - entryWidth);
    animateSize(panel, "width", { from, to });
  }
}

export const animateExit = (
  api: ViewAPI<"grid", any>,
  { id, width: exitingWidth }: AddedPanelByView<"grid">,
  onComplete: () => void,
  removePanelOnComplete = true,
) => {
  const { panels, width: fullWidth } = api;
  const difference = fullWidth - exitingWidth;
  for (const panel of panels) {
    const isExiting = panel.id === id;
    const from = panel.width;
    const to = isExiting ? 0 : panel.width / (difference) * (fullWidth);
    animateSize(panel, "width", {
      from,
      to,
      onComplete: isExiting && removePanelOnComplete
        ? () => (api.removePanel(panel), onComplete())
        : onComplete,
    });
  }
}


