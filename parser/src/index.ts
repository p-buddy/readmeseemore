
import { type ReadMeSeeMoreReserved, getLocalizedCodeBlocks, blockIsIncluded, identifyCodeBlockType, getHeadingBasedFileNamer, tryInsertCodeAsFile } from "./utils";
import type { FileSystemTree } from "@webcontainer/api";

export type Parsed = {
  filesystem: FileSystemTree;
  errors?: string[];
} & { [k in ReadMeSeeMoreReserved]?: string };

// Process:
// 1. find all code blocks, and associate them with their immediate heading(s) (if it exists)
// 2. Next, determine if the code block should be included, either by checking if it's meta has an id, or if any of it's parent headings (meaning the immediate heading or any of it's ancestors) text converted to an id matches the query.
// 2. If no id's are specified, then all code blocks should be included.
// 3. Once, code blocks have been filtered, determine the filename to associate with the code block, either by reading the 'file://' specifier in the meta, or by using the heading text
// 3a. An important thing to check first is if the code block has a 'rmsm://' protocol, which would specify some special behavior, typically startup behavior.
// 3b. If the code block does not have a filename associated and is not an `rmsm` block, then the filename should be the heading text, suffixed with a number if there are multiple code blocks in the heading

export const parse = (content: string, ...ids: string[]): Parsed => {
  const blocks = getLocalizedCodeBlocks(content).filter(block => blockIsIncluded(block, ids));
  const namer = getHeadingBasedFileNamer();
  const filesystem: FileSystemTree = {};
  let startup: string | undefined;

  for (const block of blocks) {
    const { node } = block;
    const result = identifyCodeBlockType(node);
    switch (result.type) {
      case "file":
        tryInsertCodeAsFile(filesystem, node, result.path ?? namer(block));
        break;
      case "startup":
        startup = node.value;
        break;
    }
  }

  return { startup, filesystem };
};