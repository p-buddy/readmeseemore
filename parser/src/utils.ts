import type { FileSystemTree, DirectoryNode, FileNode } from "@webcontainer/api";
import { fromMarkdown } from "mdast-util-from-markdown";
import { visit, type BuildVisitor } from "unist-util-visit";

type FileSystemNode = FileSystemTree[keyof FileSystemTree];

type Markdown = {
  Tree: ReturnType<typeof fromMarkdown>;
  Node: { [k in "Code" | "Heading"]: Parameters<BuildVisitor<Markdown["Tree"], Lowercase<k>>>[0] };
}

export const getPathParts = (path: string) => {
  const leadingOrTrailingDotsAndSlashes = /^(\.|\/)*|(\.|\/)*$/g;
  const redundantPathSeparators = /\/\.?\//g;
  const dirs = path
    .replace(leadingOrTrailingDotsAndSlashes, '')
    .replace(redundantPathSeparators, '/')
    .split("/")
    .map(part => part.trim())
    .filter(Boolean);
  return { basename: dirs.pop()!, dirs };
}

export const is = {
  file: (node: FileSystemNode): node is FileNode => "file" in node,
  directory: (node: FileSystemNode): node is DirectoryNode => "directory" in node,
}

const getHeadingText = ({ children }: Heading) => {
  const texts = children.filter((child) => child.type === "text");
  if (texts.length === 0) return null;
  return texts.map(text => text.value).join(" ");
}

export const getID = (node: Markdown["Node"][keyof Markdown["Node"]]) => {
  switch (node.type) {
    case "code":
      const { meta } = node;
      if (!meta) return null;
      const captureHashtagID = new RegExp(/(^|\s)#([a-zA-Z0-9_-]+)($|\s)/);
      const match = meta.match(captureHashtagID);
      return match ? match[2] : null;
    case "heading":
      const specialCharacters = /[^a-z0-9\s-]/g;
      const spacesPattern = /\s+/g;
      const multipleHyphens = /-+/g;
      const leadingTrailingHyphens = /^-+|-+$/g;
      return getHeadingText(node)
        ?.trim()
        .toLowerCase()
        .replace(specialCharacters, '')
        .replace(spacesPattern, '-')
        .replace(multipleHyphens, '-')
        .replace(leadingTrailingHyphens, '')
        ?? null;
  }
}

const protocol = {
  file: "file://",
  rmsm: "rmsm://",
}

const reserved = ["startup"] as const;

export type ReadMeSeeMoreReserved = typeof reserved[number];

const captureProtocol = `(^|\\s)(${Object.keys(protocol).join('|')}):\/\/([^\\s]+)($|\\s)`;

type ProtocolType = keyof typeof protocol;

const isRelevantProtocol = (type: string): type is ProtocolType => type in protocol;

type Protocol<T extends ProtocolType = ProtocolType> = { type: T, value: T extends "rmsm" ? ReadMeSeeMoreReserved : string };

export type CodeBlock = Markdown["Node"]["Code"];
export type Heading = Markdown["Node"]["Heading"];

export type LocalizedCodeBlock = {
  code: CodeBlock;
  headings: Heading[];
};

export const getProtocol = <T extends ProtocolType>({ meta }: CodeBlock): Protocol<T> | null | { error: string } => {
  if (!meta) return null;
  const match = meta.match(new RegExp(captureProtocol));
  if (!match) return null;
  const [, , type, value] = match;
  if (!isRelevantProtocol(type)) return null;
  if (type === "rmsm" && !reserved.includes(value as ReadMeSeeMoreReserved)) return { error: `Invalid rmsm protocol value: ${value}` };
  return { type, value } as Protocol<T>;
}

export const getLocalizedCodeBlocks = (content: string) => {
  const ast = fromMarkdown(content);
  const codeBlocks: LocalizedCodeBlock[] = [];
  const stack: Heading[] = [];

  visit(ast, (node) => {
    if (node.type === "heading") {
      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth)
        stack.pop();
      stack.push(node);
    } else if (node.type === "code")
      codeBlocks.push({ code: node, headings: [...stack] });
  });

  return codeBlocks;
}

export const blockIsIncluded = ({ code, headings }: LocalizedCodeBlock, ids: string[],) => {
  if (ids.length === 0) return true;
  const id = getID(code);
  if (id && ids.includes(id)) return true;
  return headings.some((heading) => {
    const id = getID(heading);
    return id && ids.includes(id);
  });
}

type FileBlock = { type: "file", path?: string };
type ReadMeSeeMoreBlock = { type: ReadMeSeeMoreReserved };

export const identifyCodeBlockType = (code: CodeBlock): FileBlock | ReadMeSeeMoreBlock => {
  const protocol = getProtocol(code);
  if (!protocol) return { type: "file" };
  if ("error" in protocol) throw new Error(protocol.error);
  const { type, value } = protocol;
  switch (type) {
    case "rmsm":
      return { type: value as ReadMeSeeMoreReserved };
    case "file":
      return { type, path: value };
  }
}

export const tryInsertCodeAsFile = (fs: FileSystemTree, code: CodeBlock, path: string) => {
  const { dirs, basename } = getPathParts(path);
  for (let i = 0; i < dirs.length; i++) {
    const part = dirs[i];
    if (!part) continue;
    fs[part] ??= { directory: {} };
    if (is.file(fs[part]))
      throw new Error(`${dirs.slice(0, i + 1).join("/")} has already been defined as a file, but is being treated as a directory`);
    fs = fs[part].directory;
  }
  fs[basename] = { file: { contents: code.value } };
}

export const getHeadingBasedFileNamer = () => {
  let unnamedFilesByHeading: Map<Heading, number>;
  let orphanFileCount = 1;
  return ({ code, headings }: LocalizedCodeBlock) => {
    const codeID = getID(code);

    if (headings.length === 0) {
      if (codeID) return `${codeID}.${code.lang}`;
      return `${orphanFileCount++}.${code.lang}`;
    }

    const parent = headings[headings.length - 1];
    const text = getHeadingText(parent);
    if (text?.endsWith(`.${code.lang}`)) return text;

    if (codeID) return `${codeID}.${code.lang}`;

    const headingID = getID(parent)!;
    unnamedFilesByHeading ??= new Map();
    const count = unnamedFilesByHeading.get(parent) ?? 0;
    unnamedFilesByHeading.set(parent, count + 1);
    return `${headingID}-${count + 1}.${code.lang}`;
  }
}