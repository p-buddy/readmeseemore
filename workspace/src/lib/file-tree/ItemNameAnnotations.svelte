<script lang="ts" module>
  import type {
    TTreeItem,
    NameEditStatus,
    Root,
  } from "$lib/file-tree/index.js";
  import { Commands } from "$lib/operating-system/commands.js";
  import {
    type SuggestionAnnotation,
    range,
  } from "$lib/operating-system/suggestions/index.js";
  import type { Snippet } from "svelte";

  type NameCheckSeverity = Exclude<NameEditStatus, "valid">;

  const colors = {
    unsafe: "var(--color-yellow-400)",
    invalid: "var(--color-red-400)",
  } satisfies Record<NameCheckSeverity, string>;

  const styles = {
    unsafe: {
      indicator: {
        style: {
          backgroundColor: colors.unsafe,
        },
      },
    },
    invalid: {
      indicator: {
        style: {
          backgroundColor: colors.invalid,
        },
      },
    },
  };
  type ItemType = TTreeItem["type"];

  type FileNameAnnotation = SuggestionAnnotation<TTreeItem["type"]>;

  const rangeWithOffset = (
    _range: SuggestionAnnotation["range"],
    offset: number,
  ) => {
    if (range.isIndex(_range)) return _range + offset;
    if (range.isSingular(_range)) {
      _range[0] += offset;
      _range[1] += offset;
    } else
      for (const range of _range) {
        range[0] += offset;
        range[1] += offset;
      }
    return _range;
  };

  const getCharacterRanges = (
    query: string,
    included: Set<string>,
    head: number,
    tail: number,
  ) => {
    const upper = query.length - tail;
    const ranges: SuggestionAnnotation["range"] = [];
    let current: number | undefined = undefined;
    for (let i = head; i < upper; i++) {
      if (included.has(query[i])) {
        current ??= i;
        continue;
      }
      if (current !== undefined) ranges.push([current, i]);
      current = undefined;
    }
    if (current !== undefined) ranges.push([current, upper]);
    const { length } = ranges;
    return length === 0 ? undefined : length === 1 ? ranges[0] : ranges;
  };

  const highlight = (
    item: Pick<TTreeItem, "type">,
    severity: NameCheckSeverity,
    _range: SuggestionAnnotation["range"],
    offset: number,
    snippet: Snippet<[TTreeItem["type"]]>,
  ): FileNameAnnotation => ({
    kind: "highlight",
    range: rangeWithOffset(_range, offset),
    indicator: styles[severity].indicator,
    key: snippet.name,
    comment: snippet,
    props: item.type,
  });

  type NameCheckResult =
    | { annotations: FileNameAnnotation[]; status: NameCheckSeverity }
    | { status: "valid"; annotations?: undefined };

  export const checkFileNameAtLocation = (
    desired: string,
    item: Pick<TTreeItem, "path" | "type">,
    root: Root,
    offset: number = 0,
  ): NameCheckResult => {
    if (desired.length === 0)
      return {
        status: "invalid",
        annotations: [highlight(item, "invalid", 0, offset, notEmpty)],
      };

    if (desired.trim() === "")
      return {
        status: "invalid",
        annotations: [
          highlight(
            item,
            "invalid",
            [0, desired.length],
            offset,
            notWhitespace,
          ),
        ],
      };

    let annotations: FileNameAnnotation[] | undefined;

    let skipHead = 0;
    let skipTail = 0;
    let invalid = false;

    if (desired.startsWith("~")) {
      invalid = true;
      const { length } = desired.match(/^~+/)![0];
      skipHead = length;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, length], offset, noTildePrefix),
      );
    } else if (desired.startsWith("-")) {
      invalid = true;
      const { length } = desired.match(/^~+/)![0];
      skipHead = length;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, length], offset, noDashPrefix),
      );
    } else if (desired.startsWith(" ")) {
      invalid = true;
      const { length } = desired.match(/^\s+/)![0];
      skipHead = length;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, length], offset, noSpacePrefix),
      );
    }

    if (desired.endsWith(" ")) {
      invalid = true;
      const { length } = desired.match(/\s+$/)![0];
      skipTail = length;
      (annotations ??= []).push(
        highlight(
          item,
          "invalid",
          [desired.length - length, desired.length],
          offset,
          noSpaceSuffix,
        ),
      );
    }

    const check = Commands.CheckFileNameChars(desired);

    if (check?.forbidden) {
      invalid = true;
      const ranges = getCharacterRanges(
        desired,
        check.forbidden,
        skipHead,
        skipTail,
      );
      if (ranges)
        (annotations ??= []).push(
          highlight(item, "invalid", ranges, offset, forbiddenCharacters),
        );
    }

    if (check?.discouraged) {
      const ranges = getCharacterRanges(
        desired,
        check.discouraged,
        skipHead,
        skipTail,
      );
      if (ranges)
        (annotations ??= []).push(
          highlight(item, "unsafe", ranges, offset, discouragedCharacters),
        );
    }

    const parent = root.findParent(item.path);
    if (!parent) throw new Error("Parent not found");

    const existing = parent.children.find(
      (child) => child !== item && child.name === desired,
    );
    if (existing) {
      invalid = true;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, desired.length], offset, conflict),
      );
    }

    return annotations
      ? { status: invalid ? "invalid" : "unsafe", annotations }
      : { status: "valid" };
  };

  export const simplify = (type: ItemType) =>
    type === "folder" ? "folder" : "file";
  const other = (type: ItemType) => (type === "folder" ? "file" : "folder");

  const capitalize = (type: ItemType) => {
    const simplified = simplify(type);
    return simplified.charAt(0).toUpperCase() + simplified.slice(1);
  };
</script>

{#snippet expand(content: string | Snippet)}
  {#if typeof content === "string"}
    {content}
  {:else}
    {@render content()}
  {/if}
{/snippet}

{#snippet withnote(index: number, content: string | Snippet)}
  <span>
    {@render expand(content)}
  </span>
  <sup>{index}</sup>
{/snippet}

{#snippet footnote(index: number, content: string | Snippet)}
  <div>
    <sup>{index}</sup>
    {@render expand(content)}
  </div>
{/snippet}

{#snippet anyPath(type: ItemType)}
  a {simplify(type)} (or {other(type)}) path
{/snippet}

{#snippet code(content: string)}
  <code>{content}</code>
{/snippet}

{#snippet note(content: string | Snippet)}
  <blockquote>
    <span class="italic">Note:</span>
    {@render expand(content)}
  </blockquote>
{/snippet}

{#snippet noteOurIssue()}
  {@render note(
    "This isn't an issue on all computers, but is a limit of our system.",
  )}
{/snippet}

{#snippet notEmpty(type: ItemType)}
  {capitalize(type)} names cannot be empty.
{/snippet}

{#snippet notWhitespace(type: ItemType)}
  {capitalize(type)} names cannot be all whitespace (aka spaces, tabs, etc.).
{/snippet}

{#snippet noTildePrefix(type: ItemType)}
  {capitalize(type)} names cannot start with
  {@render code("~")} (called a
  <strong class="italic">tilde</strong>), as it has a
  {@render withnote(1, "special meaning")} when it begins
  {@render anyPath(type)}.
  {#snippet specialMeaning()}
    When at the start of {@render anyPath(type)}, the tilde signifies a
    reference to the current user's home directory.
  {/snippet}
  {@render footnote(1, specialMeaning)}
{/snippet}

{#snippet noDashPrefix(type: ItemType)}
  {capitalize(type)} names cannot start with a
  {@render code("-")} (dash), as that is reserved for
  {@render withnote(1, "command line arguments")}. But everywhere else dashes
  are a very safe character to use, and helpful for breaking up words
  (especially instead of spaces, which aren't preferred).
  {#snippet commandLineArguments()}
    <span>Command line arguments</span> are parameters passed to programs
    executed in the terminal, ({@render code("mv")} is an example of such a program).
    Often programs, like {@render code("mv")}, take
    <span class="italic">positional arguments</span> (meaning the order in which
    parameters appear after the command name determines their meaning, which
    don't require any
    {@render code("-")}'s'). However, other programs take
    <span class="italic">named arguments</span>, which will look like
    {@render code("command --name value")}, which tells the computer to run the
    program called {@render code("command")} and give it a parameter called
    {@render code("name")} which has a value of {@render code("value")}. A
    realworld example for a pizza ordering program might be {@render code(
      "pizza --size large --topping pineapple",
    )}. You'll also see programs take <span class="italic">shortform</span>
    named arguments, which use a single dash, like {@render code(
      "pizza -s large -t pineapple",
    )}.
  {/snippet}
  {@render footnote(1, commandLineArguments)}
{/snippet}

{#snippet noSpacePrefix(type: ItemType)}
  {capitalize(type)} names cannot start with a space, as that can confuse other programs.
  {@render noteOurIssue()}
{/snippet}

{#snippet noSpaceSuffix(type: ItemType)}
  {capitalize(type)} names cannot end with a space, as that can confuse other programs.
  {@render noteOurIssue()}
{/snippet}

{#snippet forbiddenCharacters(type: ItemType)}
  These characters are not allowed in {simplify(type)} names, as they have special
  meaning within the terminal's programming langauge (aka the "shell").
  {@render note(
    "You might find that not all of these characters are forbidden on other computers.",
  )}
{/snippet}

{#snippet discouragedCharacters(type: ItemType)}
  These characters are discouraged in {simplify(type)} names, as they can make referencing
  a {simplify(type)} in terminal commands more difficult (as you can see it's already
  necessary to wrap the name in quotes ({@render code('"')}s), and will require {@render withnote(
    1,
    "escaping",
  )} in other commands).
  {#snippet escaping()}
    <span class="italic">Escaping</span> is the process of adding a backslash ({@render code(
      "\\",
    )}) before a character to make it lose its special meaning. For example, if
    you love drum and bass music and wanted to name a {simplify(type)}
    {@render code("d&b")}, when you run other commands / programs, like {@render code(
      "open",
    )}, you'll need to <span class="italic">escape</span> the ampersand ({@render code(
      "&",
    )}) like so: {@render code('open "d\\&b"')}.
  {/snippet}
  {@render footnote(1, escaping)}
{/snippet}

{#snippet conflict(type: ItemType)}
  A {simplify(type)} already exists with this name.
{/snippet}
