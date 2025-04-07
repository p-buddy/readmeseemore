import { describe, expect, test } from "vitest";
import { parse } from ".";
import { dedent } from "ts-dedent";

describe("", () => {
    test("", () => {
        const content = dedent`
        # Level 1
        
        ## Level 2

        ### Level 3
        
        ## Hello

        hehehe

        \`\`\`typescript file://test.ts #code-id
        console.log("Hello, world!");
        \`\`\`
        `;

        const expected = {
            "test.ts": {
                file: {
                    contents: "console.log(\"Hello, world!\");"
                }
            }
        }

        expect(parse(content).filesystem).toStrictEqual(expected);

        expect(parse(content, "non-existent-id").filesystem).toStrictEqual({});

        expect(parse(content, "hello").filesystem).toStrictEqual(expected);

        expect(parse(content, "code-id").filesystem).toStrictEqual(expected);

        expect(parse(content, "code-id", "hello").filesystem).toStrictEqual(expected);

        expect(parse(content, "hello", "code-id", "non-existent-id").filesystem).toStrictEqual(expected);

        expect(parse(content, "level-1").filesystem).toStrictEqual(expected);

        expect(parse(content, "level-2").filesystem).toStrictEqual({});

        expect(parse(content, "level-3").filesystem).toStrictEqual({});
    });
})