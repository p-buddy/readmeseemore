import { describe, expect, Test, test } from "vitest";
import { populates, TestsAsDocumentationConstants, type TestAsDocumentationTarget } from ".";
import { dirname, join, resolve } from "path";
import { existsSync, readFileSync, rmSync, writeFileSync } from "fs";
import { fromIndex } from "./.test-harness";
import { fromAuxiliary } from "./.test-harness/auxiliary";

describe("Tests As Documentation Identifier", () => {
  class TestClass extends TestsAsDocumentationConstants {
    static readonly Extract = TestsAsDocumentationConstants.ExtractTargetFromIdentifier;
  }

  const cases: ([TestAsDocumentationTarget, TestAsDocumentationTarget])[] = [
    [{ id: "simple" }, { id: "simple" }],
    [{ id: "#leading-hashtag" }, { id: "leading-hashtag" }],
    [{ id: "simple", file: "./README.md" }, { id: "simple", file: "./README.md" }],
    [{ id: "simple", file: "../README.md" }, { id: "simple", file: "../README.md" }],
    [{ id: "simple", file: "NoLeadingDir.md" }, { id: "simple", file: "./NoLeadingDir.md" }],
  ];

  cases.forEach(([input, expected]) => {
    test(`should extract target from identifier: ${JSON.stringify(input)}`, () => {
      const identifier = TestClass.FormIdentifier(input);
      expect(TestClass.Extract(identifier)).toEqual(expected);
    });
  });
})

describe("Tests As Documentation", () => {
  const files = getSupportingFilePaths();
  Object.values(files).filter(existsSync).forEach(x => rmSync(x));

  const packageName = getNameFromPackageJSON();

  const fromPackage = (...paths: string[]) => join(packageName, ...paths);

  const time = Date.now();

  const readmeIDs = [
    "#simple",
    "#with-existing-content",
    "#check-package-imports",
    "#self-documenting"
  ] as const;


  writeFileSync(files.readme, `# Test README (source: ${containingFile}) (location: ${files.readme}) (at: ${time})

${createMarkdownCodeBlock({ meta: readmeIDs[0] })}

${createMarkdownCodeBlock({ meta: readmeIDs[1], content: "THIS SHOULD BE OVERWRITTEN" })}

${createMarkdownCodeBlock({ meta: readmeIDs[2] })}

${createMarkdownCodeBlock({ meta: readmeIDs[3] })}

`);

  writeFileSync(files.otherMD, `# Test Other (source: ${containingFile}) (location: ${files.otherMD}) (at: ${time})
`);

  const readmeLines = () => readFileSync(files.readme, "utf-8").split("\n");

  test(populates(readmeIDs[0]), () => {
    "#simple" satisfies typeof readmeIDs[0];
    expect(checkCodeBlockStartsWithIDString(readmeLines(), readmeIDs[0])).toBe(true);
  });

  test(populates(readmeIDs[1]), () => {
    "#with-existing-content" satisfies typeof readmeIDs[1];
    expect(checkCodeBlockStartsWithIDString(readmeLines(), readmeIDs[1])).toBe(true);
  });

  test(populates(readmeIDs[2]), () => {
    "#check-package-imports" satisfies typeof readmeIDs[2];
    populates; fromIndex; fromAuxiliary; // ensure imports are captured
    const lines = readmeLines();
    const importLines = getImportLines(lines, findCodeBlockStartUsingID(lines, readmeIDs[2]) + 1);

    expect(importLines.length).toBe(4);
    expect(getImportLocationFromLine(importLines[0])).not.toBe("vitest");
    expect(getImportLocationFromLine(importLines[0])).toBe(packageName);
    expect(getImportLocationFromLine(importLines[1])).toBe(fromPackage(testHarnessName));
    expect(getImportLocationFromLine(importLines[2])).toBe(fromPackage(testHarnessName, "auxiliary"));
    expect(getImportLocationFromLine(importLines[3])).toBe("expect");

    expect(checkCodeBlockStartsWithIDString(lines, readmeIDs[2])).toBe(true);
  });

  test(populates(readmeIDs[3]), () => {
    "#self-documenting" satisfies typeof readmeIDs[3];
    let test = (...any) => { };
    test("example" + populates("#xx"), () => {

    });
  });
})

const containingFile = import.meta.url.replace(/^file:\/{2}/, "");
const directory = dirname(containingFile);
const testHarnessName = ".test-harness";
const testHarnessDirectory = join(directory, testHarnessName);

const getSupportingFilePaths = () => {
  return {
    readme: join(directory, "README.md"),
    otherMD: join(testHarnessDirectory, "other.temp.md"),
  }
}

const createMarkdownCodeBlock = ({ lang, meta, content }: { lang?: string, meta?: string, content?: string } = {}) => {
  const lines = [
    "```" + (lang ?? "ts") + (meta ? " " + meta : ""),
    "```"
  ]
  if (content) lines.splice(1, 0, content);
  return lines.join("\n");
}

const getNameFromPackageJSON = () => {
  const packageFile = resolve(directory, "..", "package.json");
  if (!existsSync(packageFile)) throw new Error("Unable to find package.json at: " + packageFile);
  return JSON.parse(readFileSync(packageFile, "utf-8")).name;
}

const findFirstLineOfCode = (lines: string[], lineIndex: number) => {
  while (lines[lineIndex].startsWith("import") || !Boolean(lines[lineIndex].trim()))
    lineIndex++;
  return lineIndex;
}

const findCodeBlockStartUsingID = (lines: string[], id: string) => {
  return lines.findIndex(x => x.startsWith("```") && x.includes(id));
}

const checkCodeBlockStartsWithIDString = (lines: string[], id: string) => {
  const codeBlockStart = findCodeBlockStartUsingID(lines, id);
  const firstLineOfCodeIndex = findFirstLineOfCode(lines, codeBlockStart + 1);
  return lines[firstLineOfCodeIndex].startsWith(`"${id}"`);
}

const getImportLines = (lines: string[], index: number) => {
  const importLines = new Array<string>();
  while (lines[index].startsWith("import")) importLines.push(lines[index++]);
  return importLines;
}

const getImportLocationFromLine = (line: string) => {
  const [_, path] = line.split(" from ");
  return path.trim().replace(/['";]/g, "");
}

const vitetest = test;

describe("Self Documenting Tests", { skip: true }, () => {

  const test = (name: string, callback: () => any) => { };

  vitetest("self-documenting" + populates("#TaD"), () => {
    test("example" + populates("#my-codeblock-target"), () => {
      // This is within a code block!
      const lines = readFileSync("README.md", "utf8").split("\n");
      expect(lines[0]).toBe("# My README");
      expect(lines[2]).toBe("... other content ...");
      expect(lines[4]).toBe("```ts ##my-codeblock-target");
      expect(lines[5]).toBe(`import { expect } from "expect";`); // `expect` is sourced from the "expect" package instead of "vitest" to enable direct execution
      expect(lines[6]).toBe(`import { readFileSync } from "fs";`);
      expect(lines[7]).toBe(``);
      expect(lines[8]).toBe(`// This is within a code block!`); // This corresponds to the first line of our test!
      expect(lines.at(-1)).toBe("```"); // last file of readme is the closing code block
    });
  });
});