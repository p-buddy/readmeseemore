import { type Component, mount, unmount } from "svelte";
import type { Props } from "./ui-framework.js";

export class TooltipSingleton<T extends Component<any, any, any>> {
  private current?: () => void;

  constructor(private readonly component: T) { }

  mount(target: HTMLElement, props: Props<T>) {
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