import type { fromMarkdown } from "mdast-util-from-markdown";
import type { BuildVisitor } from "unist-util-visit";

type MarkdownTree = ReturnType<typeof fromMarkdown>;
type MarkdownCodeNode = Parameters<BuildVisitor<MarkdownTree, "code">>[0];
type MarkdownHeadingNode = Parameters<BuildVisitor<MarkdownTree, "heading">>[0];

export const getID = (node: MarkdownCodeNode | MarkdownHeadingNode) => {
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

const protocol = {
  file: "file://",
  rmsm: "rmsm://",
}

type ProtocolType = keyof typeof protocol;

type Protocol<T extends ProtocolType = ProtocolType> = { type: T, value: string };

export const getProtocol = ({ meta }: MarkdownCodeNode): Protocol | null => {
  if (!meta) return null;
  const protocols = Object.keys(protocol);
  const captureProtocol = new RegExp(`(^|\\s)(${Object.keys(protocol).join('|')}):\/\/([^\\s]+)($|\\s)`);
  const match = meta.match(captureProtocol);
  if (!match) return null;
  return { type: match[2] as ProtocolType, value: match[3] };
}