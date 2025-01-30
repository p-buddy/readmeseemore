<script module lang="ts">
  import type {
    PanelUpdateEvent,
    IPanePart,
    PanePanelComponentInitParameter,
  } from "dockview-core";
  import { type Component, mount, unmount } from "svelte";
  import { MountMechanism, PropsUpdater } from "./utils.svelte";

  let paneCount = 0;

  class PanePanelSection<
    T extends Component<Props, Exports, any>,
    Props extends Record<string, any>,
    Exports extends Record<string, any>,
  > implements IPanePart
  {
    static Mount = new MountMechanism();
    private readonly id: string;
    private readonly svelteComponent: T;
    private readonly mountID: ReturnType<MountMechanism["id"]>;

    private readonly _element: HTMLElement;

    private propsUpdater?: PropsUpdater<Props>;
    private instance?: ReturnType<typeof mount<Props, Exports>>;

    get element() {
      return this._element;
    }

    constructor(id: string, name: string, component: T, paneIndex: number) {
      this.id = id;
      this.svelteComponent = component;
      this.mountID = PanePanelSection.Mount.id(paneIndex, id, name);
      this._element = document.createElement("div");
      this._element.style.height = "100%";
      this._element.style.width = "100%";
    }

    public init({
      params,
      api,
      title,
      containerApi,
    }: PanePanelComponentInitParameter): void {
      this.propsUpdater = new PropsUpdater<Props>({
        params,
        api,
        title,
        containerApi,
      } as any);

      this.instance = mount(this.svelteComponent, {
        target: this.element,
        props: this.propsUpdater!.props,
      });

      PanePanelSection.Mount.get(this.mountID)?.resolve(this.instance);
      PanePanelSection.Mount.drop(this.mountID);
    }

    public toJSON() {
      return {
        id: this.id,
      };
    }

    public update({ params }: PanelUpdateEvent) {
      const current = this.propsUpdater?.props;
      if (current) this.propsUpdater?.update({ ...current, params });
    }

    public dispose() {
      if (this.instance) unmount(this.instance);
    }
  }
</script>
