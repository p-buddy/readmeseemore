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

  add(port: Port) {
    this.set.add(port);
    if (!this.counts.has(port)) this.counts.set(port, 0);
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

  private static PortToID = (port: Port, instance: number) =>
    `port-${port}-${instance}`;

  static PanelIDToPort = (id: string): Port | undefined => {
    const result = parseInt(id.split("-")[1]);
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