import type { Parsed, Markdown } from ".";
import type { FileSystemTree, DirectoryNode, FileNode } from "@webcontainer/api";

type FileSystemNode = FileSystemTree[keyof FileSystemTree];

export const is = {
  file: (node: FileSystemNode): node is FileNode => "file" in node,
  directory: (node: FileSystemNode): node is DirectoryNode => "directory" in node,
  appendError: (result: ReturnType<typeof tryAppendBlock>): result is string => typeof result === "string",
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

const reserved = ["startup"] as const;

export type ReadMeSeeMoreReserved = typeof reserved[number];

const captureProtocol = `(^|\\s)(${Object.keys(protocol).join('|')}):\/\/([^\\s]+)($|\\s)`;

type ProtocolType = keyof typeof protocol;

const isProtocol = (type: string): type is ProtocolType => type in protocol;

type Protocol<T extends ProtocolType = ProtocolType> = { type: T, value: T extends "rmsm" ? ReadMeSeeMoreReserved : string };

type ProtocolError = string;

export const getProtocol = <T extends ProtocolType>({ meta }: Markdown["Node"]["Code"]): Protocol<T> | null | ProtocolError => {
  if (!meta) return null;
  const match = meta.match(new RegExp(captureProtocol));
  if (!match) return null;
  const [, , type, value] = match;
  if (!isProtocol(type)) return `Invalid protocol: ${type}`;
  if (type === "rmsm" && !reserved.includes(value as ReadMeSeeMoreReserved)) return `Invalid rmsm protocol value: ${value}`;
  return { type, value } as Protocol<T>;
}

export const tryAppendBlock = (parsed: Parsed, block: Markdown["Node"]["Code"]): true | string => {
  const protocol = getProtocol(block);
  if (!protocol) return true;
  if (typeof protocol === "string") return protocol;
  switch (protocol.type) {
    case "rmsm":
      switch (protocol.value as ReadMeSeeMoreReserved) {
        case "startup":
          if (parsed.startup) return "Multiple startup blocks provided, using the first one";
          if (block.lang !== "bash") return "Startup blocks must be bash scripts";
          parsed.startup = block.value;
          return true;
      }
    case "file":
      let { value } = protocol;
      const leadingOrTrailingDotsAndSlashes = /^(\.|\/)*|(\.|\/)*$/g;
      const redundantPathSeparators = /\/\.?\//g;

      value = value
        .replace(leadingOrTrailingDotsAndSlashes, '')
        .replace(redundantPathSeparators, '/');

      if (!value) return "Invalid file path";

      const parts = value.split('/');
      const name = parts.pop()!;
      let current = parsed.filesystem;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        current[part] ??= { directory: {} };
        if (is.file(current[part]))
          return `${parts.slice(0, i + 1).join("/")} has already been defined as a file`;
        current = current[part].directory;
      }
      current[name] = { file: { contents: block.value } };
      return true;
  }
}