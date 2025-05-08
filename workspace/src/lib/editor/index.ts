export { default as Editor, type Props as EditorProps } from "./Editor.svelte";
export { takeAction } from "./actions.js";
export { tryGetLanguageByFile } from "./languages.js";
export { createAndRegisterFileSystemProvider } from "./file-system-provider.js";