import { describe, expect, test } from "vitest";
import { parse } from ".";
import { FileNode, FileSystemTree } from "@webcontainer/api";

describe("", () => {
    test("", () => {
        const content = `
# Hello

hehehe

\`\`\`typescript file://test.ts
console.log("Hello, world!");
\`\`\`
`;
        const parsed = parse(content);
        expect(parsed.filesystem).toStrictEqual({
            "test.ts": {
                file: {
                    contents: "console.log(\"Hello, world!\");"
                }
            }
        } satisfies FileSystemTree);
    });
})