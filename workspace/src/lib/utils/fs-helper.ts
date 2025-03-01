import type { FileNode, FileSystemAPI } from "@webcontainer/api";

type FsWith<T extends keyof FileSystemAPI> = Pick<FileSystemAPI, T>;

type RemapConfig = { Promise?: boolean, Array?: boolean };

type ApplyRemap<T, Config extends RemapConfig> =
  Config["Array"] extends true
  ? Config["Promise"] extends true
  /**/ ? Promise<T[]>
  /**/ : T[]
  : Config["Promise"] extends true
  /**/ ? Promise<T>
  /**/ : T;

type ReturnExtractionConfig = { Await?: boolean, Singular?: boolean };

type FsReturn<T extends keyof FileSystemAPI, Config extends ReturnExtractionConfig = {}> =
  FileSystemAPI[T] extends (...args: any[]) => infer R
  ? R extends Promise<infer A>
  /**/ ? Config["Await"] extends true
    /**/ ? Config["Singular"] extends true
      /**/ ? A extends Array<infer I>
        /**/ ? I
        /**/ : A
      /**/ : A
    /**/ : R
  /**/ : R
  : never;

export type WithLimitFs<FsKey extends keyof FileSystemAPI> = Pick<FileSystemAPI, FsKey>;

export type WithLimitFsReturn<
  FsKey extends keyof FileSystemAPI,
  ReturnKey extends keyof FsReturn<FsKey, ExtractionConfig>,
  ExtractionConfig extends ReturnExtractionConfig = {},
  Remap extends RemapConfig = {}
> = {
    [K in keyof FsWith<FsKey>]: (
      ...args: Parameters<FsWith<FsKey>[K]>
    ) => FsReturn<FsKey> extends ApplyRemap<Pick<FsReturn<FsKey, ExtractionConfig>, ReturnKey>, Remap>
      ? ApplyRemap<Pick<FsReturn<FsKey, ExtractionConfig>, ReturnKey>, Remap>
      : {
        error: "The original return type could not be narrowed to the extracted & remapped return type",
        original: FsReturn<FsKey>,
        limitted: ApplyRemap<Pick<FsReturn<FsKey, ExtractionConfig>, ReturnKey>, Remap>
      };
  };

export const file = <Name extends string>(
  name: Name, content: string | string[]
) => ({
  [name]: {
    file: {
      contents: Array.isArray(content) ? content.join("\n") : content
    }
  } satisfies FileNode
} as { [name in Name]: FileNode })