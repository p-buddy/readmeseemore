export type { SuggestionAnnotation } from "./common.svelte.js";
export type { Range } from "./math.js";

import { isIndex, isSingleRange } from "./math.js";

export const range = {
  isIndex,
  isSingular: isSingleRange,
}