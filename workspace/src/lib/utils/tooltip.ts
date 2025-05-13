import { type Component, mount, unmount } from "svelte";
import type { Props, Exports } from "./ui-framework.js";

type MountReturn<T extends Component<any, any, any>> = {
  component: Exports<T>,
  destroy: () => void,
  target: HTMLElement
}

type IfProps<T extends Component<any, any, any>, Yes, No> =
  keyof Props<T> extends never ? No : Yes;

export class TooltipSingleton<T extends Component<any, any, any>> {
  private current?: () => void;

  constructor(private readonly component: T) { }

  mount(target: IfProps<T, never, HTMLElement>): MountReturn<T>;
  mount(target: IfProps<T, HTMLElement, never>, props: Props<T>): MountReturn<T>;
  mount(target: HTMLElement, props?: Props<T>) {
    let component = mount(this.component, { target, props });
    this.current?.();
    const destroy = async () => {
      if (this.current == destroy) this.current = undefined;
      await unmount(component, { outro: true });
      target.remove();
    };
    this.current = destroy;
    return { component, destroy, target };
  }
}