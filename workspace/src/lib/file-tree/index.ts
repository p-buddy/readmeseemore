export { default as FileTree, type Props as FileTreeProps } from "./Tree.svelte";
export { nameEdit, type EditStatus as NameEditStatus } from "./EditableName.svelte";
export { iterate } from "./common.svelte.js";
export type {
  TFileLike,
  TFolder,
  TTreeItem,
  TFile,
  LimitedFs as FileTreeLimitedFs,
  Root,
} from "./common.svelte.js";
