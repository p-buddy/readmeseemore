import type { Editor } from "$lib/Editor.svelte";
import type { Session } from "./yjs";

export type CollabInstance = {
  session: React.MutableRefObject<Session | null>,
  syncEditor: (editor: Editor) => void,
};
