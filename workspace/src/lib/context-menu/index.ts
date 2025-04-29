import { mount, unmount } from "svelte";
import ContextMenu, { type Props } from "./ContextMenu.svelte";
import { fixToBottom } from "$lib/utils/index.js";
import { createAtEvent } from "$lib/utils/index.js";
import type { Props as ComponentProps } from "$lib/utils/ui-framework.js";

export type Items = ComponentProps<typeof ContextMenu>["items"];

type OnClose = () => void;

const current = {
  menu: undefined as ContextMenu | undefined,
  close: undefined as OnClose | undefined,
  target: undefined as HTMLElement | undefined,
  unset() {
    this.menu = undefined;
    this.close = undefined;
    this.target = undefined;
  }
}

export const close = () => {
  if (current.menu) unmount(current.menu);
  current.target?.remove();
  console.log("close", current.close);
  current.close?.();
  current.unset();
};

export const register = (
  element: HTMLElement,
  getters: {
    props: () => Omit<Props, "close">,
    notAtCursor?: () => boolean
  },
  callbacks?: {
    onMount?: () => void,
    onClose?: () => void,
  }
) => element.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  event.stopPropagation();
  close();
  const target = getters.notAtCursor?.()
    ? fixToBottom(element)
    : createAtEvent(event);
  target.style.zIndex = "10000";
  target.style.backgroundColor = "transparent";
  current.target = target;
  const props = { ...getters.props(), close };
  current.menu = mount(ContextMenu, { target, props });
  current.close = callbacks?.onClose;
  callbacks?.onMount?.();
});