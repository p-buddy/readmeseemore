const easeInOut = {
  id: "ease-in-out",
  t: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export default class FolderSlideTransition {
  private version = Number.MIN_SAFE_INTEGER;
  private inflight?: number;
  private _element?: HTMLElement;

  get element() {
    if (this._element) return this._element;
    throw new Error("Element not set");
  }

  set element(element: HTMLElement) {
    if (this._element === element) return;
    element.style.willChange = "max-height";
    element.style.overflow = "hidden";
    this._element = element;
  }

  get height() {
    const { children, scrollHeight } = this.element;
    return children[0]?.getBoundingClientRect().height ?? scrollHeight;
  }

  initialHeight(opening: boolean) {
    const { height, inflight } = this;
    const now = performance.now();
    this.inflight = now;

    if (inflight === undefined) return opening ? 0 : height;

    const delta = now - inflight;
    const elapsedRatio = Math.min(delta / FolderSlideTransition.DurationMs, 1);
    const t = easeInOut.t(elapsedRatio);

    return opening ? height * (1 - t) : height * t;
  }

  fire(opening: boolean, element: HTMLElement, recursive = false as never) {
    const { style, children } = (this.element = element);
    if (!children[0]) {
      if (!recursive) requestAnimationFrame(() => this.fire(opening, element, true as never));
      return;
    }
    const version = ++this.version;
    style.maxHeight = `${this.initialHeight(opening)}px`;
    style.transition = "none";
    const desired = opening ? children[0].getBoundingClientRect().height : 0;
    requestAnimationFrame(() => {
      style.transition = FolderSlideTransition.Transition;
      style.maxHeight = `${desired}px`;
    });

    if (opening) {
      const unset = () => {
        if (this.version === version) style.maxHeight = "none";
        this.element.removeEventListener("transitionend", unset);
      };
      this.element.addEventListener("transitionend", unset);
    }
  }

  public static DurationMs = 400;
  private static Transition =
    `max-height ${FolderSlideTransition.DurationMs}ms ${easeInOut.id}`;
}