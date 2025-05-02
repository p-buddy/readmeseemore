import { existsSync } from "fs";
import { rm, mkdir, writeFile } from "fs/promises";
import { type Dirent } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json; };

export const subset = (
  obj: { [key: string]: Json; },
  ...keys: (string | Record<string, string[]>)[]
): Json =>
  keys.reduce((acc, key) => {
    if (typeof key === "string") acc[key] = obj[key];
    else {
      const keys = Object.keys(key);
      for (const k of keys) {
        const values = key[k];
        acc[k] = values.reduce((acc2, v) => {
          acc2[v] = obj[k]![v];
          return acc2;
        }, {});
      }
    }
    return acc;
  }, {} as { [key: string]: Json; });

export const expand = ({ parentPath, name }: Dirent) => join(parentPath, name);

export const localFileRegex = /^\.\/.+/;

export type Meta = { url: string; };

export const urlToAbsolute = ({ url }: Meta, to: string) =>
  resolve(dirname(fileURLToPath(url)), to); export class ResourceDirectory {
  public readonly directory: string;

  constructor(meta: Meta, to: string) {
    this.directory = urlToAbsolute(meta, to);
  }

  async clear() {
    const { directory } = this;
    if (!existsSync(directory)) return;
    await rm(directory, { force: true, recursive: true, });
  }

  async mkdir(fresh = false) {
    const { directory } = this;
    if (fresh) await this.clear();
    if (!existsSync(directory)) await mkdir(directory, { recursive: true });
    return directory;
  }

  async write(filename: string, content: string) {
    const absolute = join(await this.mkdir(), filename);
    await writeFile(absolute, content);
    return absolute;
  }
}

