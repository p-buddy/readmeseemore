import { describe, expect, test } from "vitest";
import { parse } from ".";

describe("", () => {
    test("", () => {
        const content = `
# Hello

hehehe

\`\`\`typescript
console.log("Hello, world!");
\`\`\`
`;
        const blocks = parse(content);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].lang).toBe("typescript");
        expect(blocks[0].value).toBe("console.log(\"Hello, world!\");");
    });
})