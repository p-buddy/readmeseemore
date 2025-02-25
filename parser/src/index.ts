import { fromMarkdown } from "mdast-util-from-markdown";
import { visit, type BuildVisitor } from "unist-util-visit";

type MarkdownTree = ReturnType<typeof fromMarkdown>;
type MarkdownCodeNode = Parameters<BuildVisitor<MarkdownTree, "code">>[0];
type MarkdownHeadingNode = Parameters<BuildVisitor<MarkdownTree, "heading">>[0];

export type Params = {
  packages?: string[];
  target?: string;
  startup?: string;
};

const getID = (node: MarkdownCodeNode | MarkdownHeadingNode) => {
  switch (node.type) {
    case "code":
      const { meta } = node;
      if (!meta) return null;
      const captureHashtagID = new RegExp(/(^|\s)#([a-zA-Z0-9_-]+)($|\s)/);
      const match = meta.match(captureHashtagID);
      return match ? match[2] : null;
    case "heading":
      const { children } = node;
      const text = children.find((child) => child.type === "text");
      if (!text || !text.value) return null;
      const specialCharacters = /[^a-z0-9\s-]/g;
      const spacesPattern = /\s+/g;
      const multipleHyphens = /-+/g;
      const leadingTrailingHyphens = /^-+|-+$/g;

      return text.value
        .toLowerCase()
        .replace(specialCharacters, '')
        .replace(spacesPattern, '-')
        .replace(multipleHyphens, '-')
        .replace(leadingTrailingHyphens, '');
  }
}

export const parse = (content: string, ...ids: string[]) => {
  const ast = fromMarkdown(content);
  const blocks: MarkdownCodeNode[] = [];
  const useID = ids.length > 0;

  let currentHeadingMatch: { depth: number } | null = null;

  const visitor: BuildVisitor = (node) => {
    switch (node.type) {
      case "heading":
        if (!useID) return;
        const heading = node as MarkdownHeadingNode;
        const { depth } = heading;
        if (depth <= (currentHeadingMatch?.depth ?? 0)) currentHeadingMatch = null;
        if (ids.includes(getID(heading)!)) currentHeadingMatch = { depth };
        break;
      case "code":
        const code = node as MarkdownCodeNode;
        if (!useID || currentHeadingMatch || ids.includes(getID(code)!))
          blocks.push(code);
        break;
    }
  };

  visit(ast, visitor);

  for (const block of blocks) {
    const { value, meta } = block;

  }

  return blocks;
};

