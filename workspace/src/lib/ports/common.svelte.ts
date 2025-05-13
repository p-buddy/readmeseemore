import { SvelteSet } from "svelte/reactivity";

export type Port = number;

export type PortPath =
  | `${Port}`
  | `${Port}/${string}`
  | `${Port}?${string}`
  | `${Port}?${string}&${string}`;

export class Ports {
  readonly set = new SvelteSet<Port>();
  private readonly counts = new Map<Port, number>();

  private constructor() { }

  add(port: Port, count = 0) {
    this.set.add(port);
    if (!this.counts.has(port)) this.counts.set(port, count);
  }

  remove(port: Port) {
    this.set.delete(port);
    if (this.counts.has(port)) this.counts.delete(port);
  }

  getPanelID(port: Port) {
    const count = this.counts.get(port) ?? 0;
    this.counts.set(port, count + 1);
    return Ports.PortToID(port, count);
  }

  refresh(items: { id: string }[]) {
    const port = Ports.PanelIDToPort(items[0].id);
    if (!port) throw new Error(`Invalid port from ids: ${items}`);
    if (this.set.has(port)) throw new Error(`Cannot refresh; Port ${port} already exists`);
    let max = -1;
    for (const item of items) {
      const instance = Ports.IDToInstance(item.id);
      if (instance !== undefined && instance > max) max = instance;
    }
    this.add(port, max + 1);
  }

  private static PortToID = (port: Port, instance: number) =>
    `port-${port}-${instance}`;

  static PanelIDToPort = (id?: string): Port | undefined => {
    if (!id) return undefined;
    const result = parseInt(id.slice(id.indexOf("-") + 1, id.lastIndexOf("-")));
    return isNaN(result) ? undefined : result;
  }

  private static IDToInstance = (id: string): number | undefined => {
    const result = parseInt(id.slice(id.lastIndexOf("-") + 1));
    return isNaN(result) ? undefined : result;
  }

  private static _instance: Ports;

  static get Instance() {
    if (!this._instance) throw new Error("Ports instance not initialized");
    return this._instance;
  }

  static Create() {
    this._instance = new Ports();
    return this._instance;
  }
}

export type WithPorts = {
  ports: Ports;
}