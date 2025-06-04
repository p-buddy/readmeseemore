import { type BoundingBox, resize } from "./math.js";
import { px } from "$lib/utils/index.js";
import SnippetRenderer from "$lib/utils/SnippetRenderer.svelte";
import { mount, unmount } from "svelte";
import { set, type AnyAnnotation } from "./common.svelte.js";
import type { Handle as THandle } from "./worker.js";

export type Made<T extends Record<"Make", (...args: any[]) => any>> = ReturnType<T["Make"]>;

const transition = (durationMs: number, ...keys: string[]) =>
  keys.map((key) => `${key} ${durationMs}ms ease`).join(", ");

export class Indicator {
  private static readonly DurationMs = 300;

  private static readonly InitialStyle = {
    position: "absolute",
    transform: "skewX(-15deg)",
    backgroundColor: "transparent",
    borderRadius: "0.2rem",
    opacity: "0",
    transition: transition(
      Indicator.DurationMs,
      "opacity",
      "left",
      "width",
      "background-color",
    ),
  } satisfies Partial<CSSStyleDeclaration>;

  private static readonly DefaultStylesByKind = {
    highlight: {
      opacity: "0.4",
      backgroundColor: "white",
    },
    "top-hook": {
      opacity: "1",
    },
  } satisfies Record<AnyAnnotation["kind"], Partial<CSSStyleDeclaration>>;

  static readonly Highlight = class {
    public static Resize({ style }: HTMLElement, bbox: BoundingBox) {
      const shrink = 2;
      const width = Math.max(bbox.width - shrink - 1, 0.5);
      const left = bbox.left + shrink;
      resize(style, bbox, { width, left });
      style.maskImage =
        width > 2
          ? "linear-gradient(to right, transparent 0px, black 2px, black calc(100% - 2px), transparent 100%)"
          : "linear-gradient(to right, transparent, black 40%, black 60%, transparent)";
    }
  };

  public static readonly Resize = (
    element: HTMLElement, { kind }: AnyAnnotation, bbox: BoundingBox,
  ) => {
    switch (kind) {
      case "highlight":
        Indicator.Highlight.Resize(element, bbox);
        break;
      case "top-hook":
        resize(element.style, bbox);
        break;
    }
  }

  public static readonly Make = (
    container: HTMLDivElement, annotation: AnyAnnotation, bbox: BoundingBox,
  ) => {
    const element = document.createElement("div");
    set.style(element, Indicator.InitialStyle);
    Indicator.Resize(element, annotation, bbox);
    container.appendChild(element);
    return element;
  }

  public static readonly Destroy = (element: HTMLElement) => {
    element.style.opacity = "0";
    setTimeout(() => element.remove(), Indicator.DurationMs);
  }

  public static readonly Style = (
    element: HTMLElement, { indicator, kind }: AnyAnnotation,
  ) => {
    set.css(element, Indicator.DefaultStylesByKind[kind], indicator);
  };
}

export class Comment {
  static readonly DurationMs = 500;

  private static readonly InitialStyle = {
    position: "absolute",
    opacity: "0",
    whiteSpace: "normal",
    width: "fit-content",
    height: "fit-content",
    zIndex: "10000",
    transition: transition(Comment.DurationMs, "opacity"),
  } satisfies Partial<CSSStyleDeclaration>;

  public static readonly Make = (
    { comment, props, key, commentStyle }: AnyAnnotation
  ) => {
    const element = document.createElement("div");
    set.css(element, Comment.InitialStyle, commentStyle);
    document.body.appendChild(element);
    const renderer = mount(SnippetRenderer, {
      target: element,
      props: { snippet: comment, props },
    });
    const { width, height } = element.getBoundingClientRect();

    const first = true;
    const left = Number.NaN;
    const top = Number.NaN;
    const index = Number.NaN;

    return { key, element, renderer, width, height, first, left, top, index };
  }

  public static readonly Update = (
    comment: Made<typeof Comment>,
    yOffset: number,
    localCenterX: number,
    { x, y }: DOMRect,
    index: number,
  ) => {
    comment.left = x + localCenterX - comment.width / 2;
    comment.top = y - yOffset - comment.height;
    comment.index = index;
  }

  public static Destroy({ element, renderer }: Made<typeof Comment>) {
    const { DurationMs } = Comment;
    element.style.opacity = "0";
    setTimeout(() => (unmount(renderer), element.remove()), DurationMs);
  }

  public static readonly CloneForLayout = (
    { left, top, width, height, index, }: Made<typeof Comment>
  ) => ({ left, top, width, height, index });

  static readonly AnimateOnNext = ({ element }: Made<typeof Comment>) => {
    const t = transition(Comment.DurationMs, "opacity", "left", "top");
    requestAnimationFrame(() => { element.style.transition = t });
  };

  static readonly ApplyLayout = (
    comment: Made<typeof Comment>, { left, top }: BoundingBox
  ) => {
    if (comment.first) Comment.AnimateOnNext(comment);
    comment.element.style.opacity = "1";
    comment.element.style.left = `${left}px`;
    comment.element.style.top = `${top}px`;
    comment.first = false;
  };
}

export class Handle {
  private static readonly LineThickness = 2;
  private static readonly CornerRadius = 4;
  private static readonly DurationMs = 200;

  private static readonly InitialStyle = {
    position: "absolute",
    boxSizing: "border-box",
    background: "transparent",
    overflow: "visible",
    borderTop: `${Handle.LineThickness}px solid currentColor`,
    borderLeft: `${Handle.LineThickness}px solid currentColor`,
    borderTopLeftRadius: `${Handle.CornerRadius}px`,
    borderTopRightRadius: `${Handle.CornerRadius}px`,
  } satisfies Partial<CSSStyleDeclaration>;

  private static readonly InitialDivisionStyle = {
    position: "absolute",
    zIndex: "10000",
    borderLeft: `${Handle.LineThickness}px solid currentColor`,
    transition: transition(Handle.DurationMs, "opacity"),
  } satisfies Partial<CSSStyleDeclaration>;

  private static readonly Bar = () => {
    const bar = document.createElement("div");
    set.css(bar, Handle.InitialStyle);
    bar.style.opacity = "0";
    requestAnimationFrame(() => {
      bar.style.opacity = "1";
      bar.style.transition = transition(
        Handle.DurationMs,
        "opacity",
        "height",
        "top",
        "left",
        "width",
      );
    });
    return bar;
  }

  private static readonly Tooth = () => {
    const tooth = document.createElement("div");
    set.css(tooth, Handle.InitialDivisionStyle);
    requestAnimationFrame(() => {
      tooth.style.transition = transition(
        Handle.DurationMs,
        "opacity",
        "height",
        "top",
        "left",
        "width",
        "border-right",
      );
    });
    return tooth;
  };

  public static readonly Make = (
    config: THandle,
    origin: DOMRect,
    annotation: AnyAnnotation,
  ) => {
    const bar = Handle.Bar();
    for (const _ of config.divisions) bar.appendChild(Handle.Tooth());
    Handle.Update(config, origin, bar, annotation);
    document.body.appendChild(bar);
    return bar;
  };

  public static readonly Update = (
    { left, right, topOffset, divisions }: THandle,
    { y }: DOMRect,
    bar: HTMLElement,
    { connector }: AnyAnnotation,
  ) => {
    const { InitialStyle, LineThickness, CornerRadius } = Handle;
    set.css(bar, InitialStyle, connector);
    const topHat = y - topOffset;
    const width = right - left;
    const singular = divisions.length === 1;

    bar.style.height = px(topOffset);
    bar.style.top = px(topHat);
    bar.style.left = px(left + LineThickness);
    bar.style.width = singular ? "0" : px(width + LineThickness);
    bar.style.borderRight = singular ? "none" : bar.style.borderLeft;

    const { children } = bar;
    const { length } = children;
    const last = length - 1;

    const firstChild = length < 1 ? null : (children[0] as HTMLElement);
    const lastChild = length < 2 ? null : (children[last] as HTMLElement);

    for (let i = 0; i < divisions.length; i++) {
      const division = divisions[i];
      const isFirst = i === 0;
      const isLast = i === divisions.length - 1;
      const isEdge = isFirst || isLast;
      const edgeIsHandledByParent = isEdge && divisions[i].top === topHat;

      const opacity = edgeIsHandledByParent ? "0" : "1";
      const top = isEdge ? px(LineThickness + topOffset - CornerRadius) : "0";
      const right = isLast ? px(-LineThickness) : "unset";
      const left =
        isFirst ? px(-LineThickness) :
          isLast ? "unset" :
            px(division.x - LineThickness);
      const height =
        edgeIsHandledByParent ? "0" :
          isEdge ? px(division.top - topHat - topOffset)
            : px(division.top - topHat - LineThickness);

      const element =
        isFirst
          ? (firstChild ?? bar.appendChild(Handle.Tooth()))
          : isLast
            ? (lastChild ?? bar.appendChild(Handle.Tooth()))
            : i < last
              ? children[i] as HTMLElement
              : lastChild
                ? bar.insertBefore(Handle.Tooth(), lastChild)
                : bar.appendChild(Handle.Tooth());

      element.style.opacity = opacity;
      element.style.height = height;
      element.style.top = top;
      element.style.left = left;
      element.style.right = right;
    }

    if (divisions.length < length) {
      const usedAtHead = divisions.length - 1;
      for (let i = usedAtHead; i < last; i++) {
        const child = children[i] as HTMLElement;
        child.style.height = "0";
        child.style.opacity = "0";
      }
    }
  };

  public static Destroy(element: HTMLElement) {
    element.style.opacity = "0";
    setTimeout(() => element.remove(), Handle.DurationMs);
  }
}