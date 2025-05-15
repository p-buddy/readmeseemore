import { mount, unmount } from "svelte";
import ContextMenu, { type Props } from "./ContextMenu.svelte";
import { fixToTopLeftCorner, unset } from "$lib/utils/index.js";
import { createAtEvent } from "$lib/utils/index.js";
import type { Props as ComponentProps } from "$lib/utils/svelte.js";

export type Items = ComponentProps<typeof ContextMenu>["items"];
export type Item = Items[number];
const current = {
  menu: undefined as ContextMenu | undefined,
  close: undefined as (() => void) | undefined,
  target: undefined as HTMLElement | undefined,
}

export const close = () => {
  if (current.menu) unmount(current.menu);
  current.target?.remove();
  current.close?.();
  unset(current);
};

const listeners = new Set<(event: MouseEvent) => void>();

export const onContextMenu = (callback: (event: MouseEvent) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

type RequiredProps = Omit<Props, "close">;

export const register = (
  element: HTMLElement,
  getters: {
    props: () => RequiredProps | Promise<RequiredProps>,
    notAtCursor?: () => boolean
  },
  callbacks?: {
    onMount?: () => void,
    onClose?: () => void,
  }
) => element.addEventListener("contextmenu", async (event) => {
  for (const listener of listeners) listener(event);
  event.preventDefault();
  event.stopPropagation();
  close();
  const target = getters.notAtCursor?.()
    ? fixToTopLeftCorner(element)
    : createAtEvent(event);
  target.style.zIndex = "10000";
  target.style.backgroundColor = "transparent";
  current.target = target;
  const props = { ...(await getters.props()), close };
  current.menu = mount(ContextMenu, { target, props });
  current.close = callbacks?.onClose;
  callbacks?.onMount?.();
});