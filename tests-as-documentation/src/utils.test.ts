import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createReverseExportLookup, getAbsoluteFileCandidates, tryFindClosestFileMatch } from "./utils";
import { join } from "path";
import type { Package } from "./Reporter";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "fs";

describe(createReverseExportLookup.name, () => {
  const testPath = "/dummy";
  const pathTo = (path: string) => join(testPath, path);
  const packageName = "my-package";

  const testCase = (
    exports: Package["details"]["exports"], expected: ReturnType<typeof createReverseExportLookup>
  ): [pkg: Package<"name">["details"], expected: ReturnType<typeof createReverseExportLookup>] => [
      { name: packageName, exports: exports ?? {} }, expected
    ];

  const cases = [
    testCase({ ".": "./index.js" }, new Map([[pathTo("index.js"), "my-package"]])),

    testCase("./index.js", new Map([[pathTo("index.js"), "my-package"]])),

    testCase(
      {
        ".": "./lib/index.js",
        "./feature": "./feature/index.js"
      },
      new Map([
        [pathTo("lib/index.js"), "my-package"],
        [pathTo("feature/index.js"), "my-package/feature"],
      ])
    ),

    testCase(
      {
        ".": "./lib/index.js",
        "./feature": {
          import: "./feature/index.js",
          require: "./feature/index.cjs"
        }
      },
      new Map([
        [pathTo("lib/index.js"), "my-package"],
        [pathTo("feature/index.js"), "my-package/feature"],
      ])
    ),
  ]

  cases.forEach(([details, expected], index) => {
    test(`create a reverse lookup for ${details.name}: ${index}`, () => {
      const reverseLookup = createReverseExportLookup({ details, path: join(testPath, "package.json") });
      expect(reverseLookup).toEqual(expected);
    });
  });
});

describe(getAbsoluteFileCandidates.name, () => {
  test("should return the correct absolute file candidates", () => {

    expect(
      getAbsoluteFileCandidates("./src/foo.ts", "/Users/dummy/src/my-package")
    ).toEqual([
      "/Users/dummy/src/my-package/src/foo.ts",
    ]);

    expect(
      getAbsoluteFileCandidates("./src/foo", "/Users/dummy/src/my-package")
    ).toEqual([
      "/Users/dummy/src/my-package/src/foo.ts",
      "/Users/dummy/src/my-package/src/foo.js",
      "/Users/dummy/src/my-package/src/foo.cjs",
      "/Users/dummy/src/my-package/src/foo.mjs",
      "/Users/dummy/src/my-package/src/foo/index.ts",
      "/Users/dummy/src/my-package/src/foo/index.js",
      "/Users/dummy/src/my-package/src/foo/index.cjs",
      "/Users/dummy/src/my-package/src/foo/index.mjs",
    ]);
  });
});

describe(tryFindClosestFileMatch.name, () => {
  const testHarnessDir = join(__dirname, '.test-harness', tryFindClosestFileMatch.name + ".temp.tests");

  beforeEach(() => {
    if (existsSync(testHarnessDir))
      rmSync(testHarnessDir, { recursive: true, force: true });
    mkdirSync(testHarnessDir, { recursive: true });
  });

  afterEach(() => rmSync(testHarnessDir, { recursive: true }));

  test("finds file in starting directory", () => {
    const startDir = join(testHarnessDir, 'path');
    mkdirSync(startDir, { recursive: true });
    writeFileSync(join(startDir, 'target.temp.txt'), '');

    const result = tryFindClosestFileMatch({
      startingPointDir: startDir,
      specifiers: ['target.temp.txt']
    });

    expect(result).toBe(join(startDir, 'target.temp.txt'));
  });

  test("finds file in parent directory", () => {
    const parentDir = testHarnessDir;
    const startDir = join(parentDir, 'path');
    mkdirSync(startDir, { recursive: true });
    writeFileSync(join(parentDir, 'target.temp.txt'), '');

    const result = tryFindClosestFileMatch({
      startingPointDir: startDir,
      specifiers: ['target.temp.txt']
    });

    expect(result).toBe(join(parentDir, 'target.temp.txt'));
  });

  test("returns undefined when no file found", () => {
    const startDir = join(testHarnessDir, 'path');
    mkdirSync(startDir, { recursive: true });

    const result = tryFindClosestFileMatch({
      startingPointDir: startDir,
      specifiers: ['target.temp.txt']
    });

    expect(result).toBeUndefined();
  });

  test("calls error callback when multiple matches found", () => {
    const startDir = join(testHarnessDir, 'path');
    mkdirSync(startDir, { recursive: true });
    writeFileSync(join(startDir, 'file1.temp.txt'), '');
    writeFileSync(join(startDir, 'file2.temp.txt'), '');

    let errorMsg: string | undefined;

    const result = tryFindClosestFileMatch({
      startingPointDir: startDir,
      specifiers: ['file1.temp.txt', 'file2.temp.txt'],
      error: (msg) => errorMsg = msg
    });

    expect(result).toBeUndefined();
    expect(errorMsg).toBeDefined();
    expect(errorMsg).toContain(`Multiple matching files found in ${startDir}`);
  });
});