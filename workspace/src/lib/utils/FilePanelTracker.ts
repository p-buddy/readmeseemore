type Key = "path" | "id";
type Value<T extends Key> = T extends "path" ? string : number;

export default class FilePanelTracker {
  #count = 0;
  #idByPath = new Map<string, number>();
  #pathById = new Map<number, string>();
  add(path: string) {
    const id = this.#idByPath.get(path) ?? this.#count++;
    this.set(path, id);
    return id;
  }
  set(path: string, id: number) {
    this.#idByPath.set(path, id);
    this.#pathById.set(id, path);
  }
  id(path: string) {
    return this.#idByPath.get(path);
  }
  path(id: number) {
    return this.#pathById.get(id);
  }
  has<T extends Key>(kind: T, value: Value<T>) {
    return kind === "path"
      ? this.#idByPath.has(value as string)
      : this.#pathById.has(value as number);
  }
  drop<T extends Key>(kind: T, value: Value<T>) {
    switch (kind) {
      case "path":
        const id = this.#idByPath.get(value as string);
        if (id === undefined) return;
        this.#idByPath.delete(value as string);
        this.#pathById.delete(id);
        break;
      case "id":
        const path = this.#pathById.get(value as number);
        if (path === undefined) return;
        this.#pathById.delete(value as number);
        this.#idByPath.delete(path);
        break;
    }
  }
}