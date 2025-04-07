
import { type ReadMeSeeMoreReserved, getLocalizedCodeBlocks, blockIsIncluded, identifyCodeBlockType, getHeadingBasedFileNamer, tryInsertCodeAsFile } from "./utils";
import type { FileSystemTree } from "@webcontainer/api";

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