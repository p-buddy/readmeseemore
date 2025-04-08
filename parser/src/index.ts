import { type ReadMeSeeMoreReserved, getLocalizedCodeBlocks, blockIsIncluded, identifyCodeBlockType, getHeadingBasedFileNamer, tryInsertCodeAsFile, mergeFilesystems } from "./utils";
import type { FileSystemTree, } from "@webcontainer/api";

type Parsed = {
  filesystem: FileSystemTree;
  errors?: string[];
} & { [k in ReadMeSeeMoreReserved]?: string };

export const parse = (content: string, ...ids: string[]): Parsed => {
  const blocks = getLocalizedCodeBlocks(content).filter(block => blockIsIncluded(block, ids));
  const filesystem: FileSystemTree = {};
  let startup: string | undefined;
  const errors: string[] = [];

  const namer = getHeadingBasedFileNamer();
  for (const block of blocks) {
    const { code } = block;
    const result = identifyCodeBlockType(code);
    switch (result.type) {
      case "file":
        try {
          tryInsertCodeAsFile(filesystem, code, result.path ?? namer(block));
        } catch (e) {
          errors.push(e.toString());
        }
        break;
      case "startup":
        startup = code.value;
        break;
    }
  }

  return { startup, filesystem, errors };
};

const empty = (): Parsed => ({ filesystem: {} });

export const multiparse = (contents: string[], ...ids: string[]): Parsed =>
  contents.reduce((acc, content) => {
    const result = parse(content, ...ids);

    result.errors ??= [];
    mergeFilesystems({ target: acc.filesystem, source: result.filesystem, errors: result.errors });

    if (result.startup)
      acc.startup = acc.startup
        ? acc.startup + "\n" + result.startup
        : result.startup;

    if (result.errors.length > 0) {
      acc.errors ??= [];
      acc.errors.push(...result.errors);
    }

    return acc;
  }, empty());

export { mergeFilesystems };