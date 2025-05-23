export type { SuggestionAnnotation } from "./common.svelte.js";
import { isIndex, isSingleRange } from "./math.js";

export const range = {
  isIndex,
  isSingular: isSingleRange,
}