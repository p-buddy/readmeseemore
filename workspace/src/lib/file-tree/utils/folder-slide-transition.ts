const easeInOut = {
  id: "ease-in-out",
  t: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

export default class FolderSlideTransition {
  private version = Number.MIN_SAFE_INTEGER;
  private inflight?: number;

  get height() {
    const { children, scrollHeight } = this.element;
    return children[0]?.getBoundingClientRect().height ?? scrollHeight;
  }

  constructor(private element: HTMLElement) {
    this.element = element;
    const { style } = this.element;
    style.willChange = "max-height";
    style.overflow = "hidden";
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

  fire(opening: boolean) {
    const version = ++this.version;
    const { style, children } = this.element;
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