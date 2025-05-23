import { type IDisposable, type Terminal } from "$lib/operating-system/index.js";

type SuggestionTerminal = Pick<Terminal, "suggest" | "enqueueCommand">

/**
 * A suggestion scope handles:
 * - displaying a suggestion when the mouse enters an element
 * - disposing the suggestion when the mouse leaves an element
 * - executing a command and disposing the suggestion when an element is clicked
 * 
 * By being a `nonFlickering` suggestion scope, we mean that a new suggestion 
 * will not fade in if there is a suggestion currently fading out (all within this scope).
 * 
 * This was deemed nicer on the eye, since if elements are both fading and fading out and can look like a strobe effect.
 * 
 * @returns A function that creates an event handler object for a specific element. 
 * In this way, the first invocation of `nonFlickeringSuggestionScope()` creates a scope that can tie multiple elements together,
 * while the second invocation creates a series of event handlers to tie to a specific element (or at least specific kind of element).
 */
export const nonFlickeringSuggestionScope = () => {
  let last: number | undefined;
  let suggestion: IDisposable | undefined;
  const dispose = () => (suggestion?.dispose(), (last = Date.now()));
  return {
    onmouseenter: (command: string, terminal: SuggestionTerminal) => {
      suggestion?.dispose();
      const fadeIn = Boolean(!last || Date.now() - last > 100);
      suggestion = terminal!.suggest(command, fadeIn);
    },
    onmouseleave: dispose,
    onclick: (command: string, terminal: SuggestionTerminal) => {
      dispose();
      terminal.enqueueCommand(command);
    },
  };
}

export const dynamicNonFlickeringSuggestionScope = (terminal: SuggestionTerminal) => {
  const events = nonFlickeringSuggestionScope();
  return (command: ((condition: "click" | "enter") => string | Promise<string>) | string) =>
    typeof command === "string"
      ? {
        onmouseenter: events.onmouseenter.bind(null, command, terminal),
        onmouseleave: events.onmouseleave,
        onclick: events.onclick.bind(null, command, terminal),
      }
      : {
        onmouseenter: async () => events.onmouseenter(await command("enter"), terminal),
        onmouseleave: events.onmouseleave,
        onclick: async () => events.onclick(await command("click"), terminal),
      };
}

export const destinationIndexFromMv = (cmd: string) => {
  const firstSpace = cmd.indexOf(" ");
  const sourceIsQuoted = cmd[firstSpace + 1] === '"';
  const sourceEndIncludingSpace = sourceIsQuoted
    ? cmd.indexOf('"', firstSpace + 2) + 1
    : cmd.indexOf(" ", firstSpace + 1);
  const destinationIsQuoted = cmd[sourceEndIncludingSpace + 1] === '"';
  return sourceEndIncludingSpace + (destinationIsQuoted ? 2 : 1);
}