import { describe, test, expect } from "vitest";
import { exists, prependRoot, parts, dirname, removeTrailing, trimChar, trimSlash } from "./utils.js";
import { root } from "$lib/utils/webcontainer.js";
import type { WithLimitFs } from "$lib/utils/fs-helper.js";
import type { FileSystemTree, DirEnt, FileNode, DirectoryNode } from "@webcontainer/api"

describe(prependRoot.name, () => {
  test("basic", (x) => {
    expect(prependRoot("/test.txt")).toBe(root + "test.txt");
    expect(prependRoot("test.txt")).toBe(root + "test.txt");
    expect(prependRoot("/")).toBe(root);
    expect(prependRoot("hi/hello")).toBe(root + "hi/hello");
  })
});

describe(parts.name, () => {
  test("basic", (x) => {
    expect(parts(prependRoot("test"))).toEqual({ directory: removeTrailing(root, "/"), name: "test" });
    expect(parts("/x/y/z/")).toEqual({ directory: "/x/y", name: "z" });
  })
});

describe(dirname.name, () => {
  test("basic", (x) => {
    expect(dirname("/x/y/z/")).toBe("/x/y");
    expect(dirname("/x/y/z")).toBe("/x/y");
    expect(dirname("/x/y/")).toBe("/x");
    expect(dirname("/x/y")).toBe("/x");
  })
});

const fs = {
  file: (name: string, contents: string = ""): FileSystemTree => ({
    [name]: {
      file: {
        contents,
      }
    } satisfies FileNode
  }),

  directory: (name: string, ...entries: FileSystemTree[]) => ({
    [name]: {
      directory: entries.reduce((acc, current) => {
        return { ...acc, ...current };
      }, {} as DirectoryNode["directory"]),
    } satisfies DirectoryNode
  }),

  mock: (tree: FileSystemTree) => ({
    readdir: async (path: string) => {
      let curr = tree;
      for (const part of trimSlash(path).split("/"))
        if (!curr[part]) throw new Error(`Not found (${part} of ${path})`);
        else if ("directory" in curr[part]) curr = curr[part].directory;
        else throw new Error(`Not a directory (${part} of ${path})`)

      return Object.entries(curr)
        .map(([key, value]) => ({
          name: key,
          isFile: () => "file" in value,
          isDirectory: () => "directory" in value,
        } satisfies DirEnt<string>));
    }
  }),
};

/**
 * x:
 * - y
 * - z:
 *   - a
 *   - b
 *   - c:
 *     - d
 */
const testTree = () => {
  const { file, directory } = fs;
  const tree =
    directory("x",
      file("y"),
      directory("z",
        file("a"),
        file("b"),
        directory("c", file("d"))));
  return tree;
}

describe(fs.mock.name, () => {
  test("basic", async () => {
    const tree = testTree();
    const _fs = fs.mock(tree);
    let dir = await _fs.readdir("/x");
    expect(dir.map(({ name }) => name)).toEqual(["y", "z"]);
    expect(dir.find(({ name }) => name === "y")?.isFile()).toBe(true);
    expect(dir.find(({ name }) => name === "z")?.isDirectory()).toBe(true);
    dir = await _fs.readdir("/x/z");
    expect(dir.map(({ name }) => name)).toEqual(["a", "b", "c"]);
    expect(dir.find(({ name }) => name === "a")?.isFile()).toBe(true);
    expect(dir.find(({ name }) => name === "b")?.isFile()).toBe(true);
    expect(dir.find(({ name }) => name === "c")?.isDirectory()).toBe(true);
    dir = await _fs.readdir("/x/z/c");
    expect(dir.map(({ name }) => name)).toEqual(["d"]);
    expect(dir.find(({ name }) => name === "d")?.isFile()).toBe(true);
  })
})

const testFs = () => {
  const tree = trimSlash(root).split("/").reverse().reduce((acc, part) => {
    return fs.directory(part, acc);
  }, testTree());
  return fs.mock(tree) as unknown as WithLimitFs<"readdir">;
}

describe(exists.name, () => {
  test("basic", async () => {
    const fs = testFs();

    const expectFile = async (path: string) => {
      expect(await exists(fs, path)).toBe(true);
      expect(await exists(fs, path, true)).toBe(true);
      expect(await exists(fs, path, false)).toBe(false);
    }

    const expectDirectory = async (path: string) => {
      expect(await exists(fs, path)).toBe(true);
      expect(await exists(fs, path, true)).toBe(false);
      expect(await exists(fs, path, false)).toBe(true);
    }

    await expectFile("/x/y");
    await expectDirectory("/x/z");
    await expectFile("/x/z/a");
    await expectFile("/x/z/b");
    await expectDirectory("/x/z/c");
    await expectFile("/x/z/c/d");

    expect(await exists(fs, "/x/a")).toBe(false);
    expect(await exists(fs, "/x/z/x")).toBe(false);
    expect(await exists(fs, "/x/z/c/e", true)).toBe(false);
  })
})
