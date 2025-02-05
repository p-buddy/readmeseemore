<script lang="ts" module>
  import {
    DockviewGroupPanel,
    DockviewMutableDisposable,
    type DockviewFrameworkOptions,
    type IHeaderActionsRenderer,
  } from "dockview-core";
  import type {
    ComponentsConstraint,
    DockviewSpecificComponentConstraint,
    DockviewTabConstraint,
    ModifiedProps,
    RecursivePartial,
    SnippetsConstraint,
  } from "./utils.svelte";

  class SvelteActionsHeaderRenderer implements IHeaderActionsRenderer {
    private readonly mutableDisposable = new DockviewMutableDisposable();
    private readonly _element: HTMLElement;
    private readonly _group: DockviewGroupPanel;

    get element(): HTMLElement {
      return this._element;
    }

    constructor(group: DockviewGroupPanel) {
      this._element = document.createElement("div");
      this._element.className = "dv-react-part";
      this._element.style.height = "100%";
      this._element.style.width = "100%";
      this._group = group;
    }

    init(parameters: {
      containerApi: DockviewApi;
      api: DockviewGroupPanelApi;
    }): void {
      this.mutableDisposable.value = new DockviewCompositeDisposable(
        this._group.model.onDidAddPanel(() => {
          this.updatePanels();
        }),
        this._group.model.onDidRemovePanel(() => {
          this.updatePanels();
        }),
        this._group.model.onDidActivePanelChange(() => {
          this.updateActivePanel();
        }),
        parameters.api.onDidActiveChange(() => {
          this.updateGroupActive();
        }),
      );

      this._part = new ReactPart(
        this.element,
        this.reactPortalStore,
        this.component,
        {
          api: parameters.api,
          containerApi: parameters.containerApi,
          panels: this._group.model.panels,
          activePanel: this._group.model.activePanel,
          isGroupActive: this._group.api.isActive,
          group: this._group,
        },
      );
    }

    dispose(): void {
      this.mutableDisposable.dispose();
      this._part?.dispose();
    }

    update(event: PanelUp): void {
      this._part?.update(event.params);
    }

    private updatePanels(): void {
      this.update({ params: { panels: this._group.model.panels } });
    }

    private updateActivePanel(): void {
      this.update({
        params: {
          activePanel: this._group.model.activePanel,
        },
      });
    }

    private updateGroupActive(): void {
      this.update({
        params: {
          isGroupActive: this._group.api.isActive,
        },
      });
    }
  }
</script>

<script
  lang="ts"
  generics="
  const Components extends ComponentsConstraint<`dock`>,
  const Snippets extends SnippetsConstraint<`dock`>,
  const TabComponent extends DockviewTabConstraint[`components`],
  const TabSnippet extends DockviewTabConstraint[`snippets`],
  const Watermark extends DockviewSpecificComponentConstraint[`watermark`],
  const DefaultTab extends DockviewSpecificComponentConstraint[`defaultTab`],
  const RightHeaderActions extends DockviewSpecificComponentConstraint[`rightHeaderActions`],
  const LeftHeaderActions extends DockviewSpecificComponentConstraint[`leftHeaderActions`],
  const PrefixHeaderActions extends DockviewSpecificComponentConstraint[`prefixHeaderActions`],
"
>
  type DockSpecific = {
    tabs: {
      components: TabComponent;
      snippets: TabSnippet;
    };
    watermark: Watermark;
    defaultTab: DefaultTab;
    rightHeaderActions: RightHeaderActions;
    leftHeaderActions: LeftHeaderActions;
    prefixHeaderActions: PrefixHeaderActions;
  };

  type Props = RecursivePartial<DockSpecific> &
    ModifiedProps<"dock", Components, Snippets, DockSpecific>;

  let {
    components,
    snippets,
    tabs,
    watermark,
    defaultTab,
    rightHeaderActions,
    leftHeaderActions,
    prefixHeaderActions,
    onReady,
    onDidDrop,
    onWillDrop,
    ...props
  }: Props = $props();

  const frameworkOptions: DockviewFrameworkOptions = {
    createComponent: (options) => {},
  };
</script>
