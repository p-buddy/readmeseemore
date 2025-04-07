import { describe, expect, test } from "vitest";
import { parse } from ".";
import { dedent } from "ts-dedent";

const single = (name: string, contents: string) => ({
    [name]: {
        file: {
            contents
        }
    }
})

const nested = (dir: string, name: string, contents: string) => ({
    [dir]: {
        directory: {
            [name]: { file: { contents } }
        }
    }
})

describe("", () => {
    test("basic multilevel", () => {
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

        const expected = single("test.ts", "console.log(\"Hello, world!\");");

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

    test("name based on file protocol", () => {
        const json = JSON.stringify({ "name": "test" })
        const content = dedent`
        # heading

        \`\`\`json file://package.json
        ${json}
        \`\`\`
        `

        expect(parse(content, "heading").filesystem).toStrictEqual(single("package.json", json));
    })

    test("name based on heading", () => {
        const json = JSON.stringify({ "name": "test" })
        const content = dedent`
        # package.json

        \`\`\`json #code-id
        ${json}
        \`\`\`
        `

        expect(parse(content, "code-id").filesystem).toStrictEqual(single("package.json", json));
    })

    test("name with slashes", () => {

        const content = dedent`
        # heading

        \`\`\`typescript file://test/test.ts #code-id
        console.log("Hello, world!");
        \`\`\`
        `

        expect(parse(content, "heading").filesystem).toStrictEqual(nested("test", "test.ts", "console.log(\"Hello, world!\");"));
    })

    test("unnamed", () => {
        const codes = [
            "console.log(\"Hello, world!\");",
            "console.log(\"Hello, galaxy!\");",
            "console.log(\"Hello, universe!\");",
        ]
        const content = dedent`
        # heading

        \`\`\`ts #code-id
        ${codes[0]}
        \`\`\`

        \`\`\`ts
        ${codes[1]}
        \`\`\`\

        \`\`\`ts
        ${codes[2]}
        \`\`\`
        `

        expect(parse(content, "heading").filesystem).toStrictEqual({
            "code-id.ts": { file: { contents: codes[0] } },
            "heading-1.ts": { file: { contents: codes[1] } },
            "heading-2.ts": { file: { contents: codes[2] } },
        });
    })
})