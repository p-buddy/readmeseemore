export { default as Terminal, type IDisposable, type TerminalSuggestion } from "./terminal/index.js";
export { default as OperatingSystem, type CreateOptions } from "./os.js";
export { getItems as getTerminalContextItems } from "./terminal/Context.svelte";
export { Commands as TerminalCommands } from "./terminal/commands.js";
export { type Range, range, type SuggestionAnnotation as TerminalSuggestionAnnotation } from "./terminal/suggestions/index.js";