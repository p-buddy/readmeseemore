import { fromMarkdown } from "mdast-util-from-markdown";
import { visit, type BuildVisitor } from "unist-util-visit";
import { getID, tryAppendBlock, is } from "./utils";
import type { FileSystemTree } from "@webcontainer/api";

export type Markdown = {
  Tree: ReturnType<typeof fromMarkdown>;
  Node: { [k in "Code" | "Heading"]: Parameters<BuildVisitor<Markdown["Tree"], Lowercase<k>>>[0] };
}

export type Parsed = {
  startup?: string;
  filesystem: FileSystemTree;
  errors?: string[];
};

export const parse = (content: string, ...ids: string[]) => {
  const ast = fromMarkdown(content);
  const blocks: Markdown["Node"]["Code"][] = [];
  const useID = ids.length > 0;

  let currentHeadingMatch: { depth: number } | null = null;

  const visitor: BuildVisitor = (node) => {
    switch (node.type) {
      case "heading":
        if (!useID) return;
        const heading = node as Markdown["Node"]["Heading"];
        const { depth } = heading;
        if (depth <= (currentHeadingMatch?.depth ?? -1)) currentHeadingMatch = null;
        if (ids.includes(getID(heading)!)) currentHeadingMatch = { depth };
        break;
      case "code":
        const code = node as Markdown["Node"]["Code"];
        if (!useID || currentHeadingMatch || ids.includes(getID(code)!))
          blocks.push(code);
        break;
    }
  };

  visit(ast, visitor);

  const parsed: Parsed = { filesystem: {} };
  const tryAppend = tryAppendBlock.bind(null, parsed);
  parsed.errors = blocks.map(tryAppend).filter(is.appendError);
  return parsed;
};

