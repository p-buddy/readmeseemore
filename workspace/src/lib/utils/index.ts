import type { MouseEventHandler } from "svelte/elements";

export const singleClickWrapper = <Args extends any[], Return>(
  fn: (...args: Args) => Return, delay = 150
) => {
  let clickCount = 0;
  let timeout: NodeJS.Timeout | null = null;
  const reset = () => clickCount = 0;
  const tryExecute = (args: Args) => --clickCount > 0 || fn(...args);
  return (...args: Args) => {
    if (++clickCount > 1) {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(reset, delay);
    }
    else timeout = setTimeout(() => tryExecute(args), delay);
  }
};

export const mouseEventToCaretIndex = <
  T extends MouseEvent & { currentTarget: Target },
  Target extends HTMLElement,
>(
  { currentTarget, offsetX }: T,
  { length }: string
) => {
  const spanWidth = currentTarget.getBoundingClientRect().width;

  if (length === 0) return 0;

  const approxCharWidth = spanWidth / length;
  const caretIndex = Math.round(offsetX / approxCharWidth);
  return caretIndex > length ? length : caretIndex;
}

export const defer = <T>() => {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

export const retry = <T>(fn: () => Promise<T>, delay = 100) =>
  new Promise<T>((resolve, reject) => {
    fn().then(resolve).catch(() => setTimeout(() => retry(fn, delay), delay));
  });

export type OnClick<T extends HTMLElement = HTMLButtonElement> = MouseEventHandler<T>;

export const dirname = (path: string) => path.split("/").slice(0, -1).join("/");

export type OnlyRequire<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>;

export const createAtEvent = ({ clientX, clientY }: MouseEvent, parent?: HTMLElement) => {
  const element = document.createElement("div");
  element.style.position = "fixed";
  element.style.top = `${clientY}px`;
  element.style.left = `${clientX}px`;
  return (parent ?? document.body).appendChild(element);
}