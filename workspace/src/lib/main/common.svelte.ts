import { Commands, type IDisposable, type Terminal } from "$lib/operating-system/index.js";
import type { FileTree, NameEditStatus } from "$lib/file-tree/index.js";
import type { Exports } from "$lib/utils/svelte.js";
import type { Root, TTreeItem } from "$lib/file-tree/common.svelte.js";
import type { Snippet } from "svelte";
import {
  noTildePrefix,
  noDashPrefix,
  noSpacePrefix,
  noSpaceSuffix,
  forbiddenCharacters,
  discouragedCharacters,
  type Annotation,
  simplify,
} from "../file-tree/ItemNameAnnotations.svelte";
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
  return (command: (() => string | Promise<string>) | string) =>
    typeof command === "string"
      ? {
        onmouseenter: events.onmouseenter.bind(null, command, terminal),
        onmouseleave: events.onmouseleave,
        onclick: events.onclick.bind(null, command, terminal),
      }
      : {
        onmouseenter: async () => events.onmouseenter(await command(), terminal),
        onmouseleave: events.onmouseleave,
        onclick: async () => events.onclick(await command(), terminal),
      };
}

const getCharacterRanges = (
  query: string,
  target: Set<string>,
  skipHead: number,
  skipTail: number,
  offset: number,
) => {
  const ranges: Annotation["ranges"] = [];
  let current: number | undefined = undefined;
  for (let i = skipHead; i < query.length - skipTail; i++) {
    if (target.has(query[i])) {
      current ??= i;
    }
    else {
      if (current !== undefined) ranges.push([current + offset, i + offset]);
      current = undefined;
    }
  }

  if (current !== undefined) ranges.push([current + offset, query.length + offset]);

  return ranges.length === 0 ? undefined : ranges.length === 1 ? ranges[0] : ranges;
}

export const checkFileNameAtLocation = (
  desired: string,
  item: Pick<TTreeItem, "path" | "type">,
  root: Root,
  offset: number = 0,
): Annotation[] | undefined => {
  const prefix = item.type === "folder" ? "Folder name" : "File name";

  if (desired.length === 0) return [{
    severity: "invalid",
    message: `${prefix} cannot be empty`,
  }];

  if (desired.trim() === "") return [{
    severity: "invalid",
    message: `${prefix} cannot be all space (aka whitespace) characters`,
    ranges: [0, desired.length],
  }];

  let annotations: Annotation[] | undefined;

  let skipHead = 0;
  let skipTail = 0;

  if (desired.startsWith("~")) {
    const { length } = desired.match(/^~+/)![0];
    skipHead = length;
    (annotations ??= []).push({
      severity: "invalid",
      message: noTildePrefix,
      ranges: [0 + offset, length + offset],
    })
  }
  else if (desired.startsWith("-")) {
    const { length } = desired.match(/^~+/)![0];
    skipHead = length;
    (annotations ??= []).push({
      severity: "invalid",
      message: noDashPrefix,
      ranges: [0 + offset, length + offset],
    })
  }
  else if (desired.startsWith(" ")) {
    const { length } = desired.match(/^\s+/)![0];
    skipHead = length;
    (annotations ??= []).push({
      severity: "invalid",
      message: noSpacePrefix,
      ranges: [0 + offset, length + offset],
    })
  }

  if (desired.endsWith(" ")) {
    const { length } = desired.match(/\s+$/)![0];
    skipTail = length;
    (annotations ??= []).push({
      severity: "invalid",
      message: noSpaceSuffix,
      ranges: [desired.length - length, desired.length],
    })
  }

  const check = Commands.CheckFileNameChars(desired);

  if (check?.forbidden) {
    const ranges = getCharacterRanges(
      desired,
      check.forbidden,
      skipHead,
      skipTail,
      offset,
    );
    if (ranges)
      (annotations ??= []).push({
        severity: "invalid",
        message: forbiddenCharacters,
        ranges,
      });
  }

  if (check?.discouraged) {
    const ranges = getCharacterRanges(
      desired,
      check.discouraged,
      skipHead,
      skipTail,
      offset,
    );
    if (ranges)
      (annotations ??= []).push({
        severity: "unsafe",
        message: discouragedCharacters,
        ranges,
      });
  }

  const parent = root.findParent(item.path);
  if (!parent) throw new Error("Parent not found");

  const existing = parent.children.find(child => child !== item && child.name === desired);
  if (existing)
    (annotations ??= []).push({
      severity: "invalid",
      message: `A ${simplify(existing.type)} already exists with this name`,
      ranges: [0 + offset, desired.length + offset],
    });

  return annotations;
}

const isSingleRange = (
  ranges: Required<Annotation>["ranges"],
): ranges is [number, number] => !Array.isArray(ranges[0]);



export const validateAnnotations = (annotations?: Annotation[]): NameEditStatus => {
  if (!annotations) return "valid";
  for (const annotation of annotations)
    if (annotation.severity === "invalid") return "invalid";
  return "unsafe";
}