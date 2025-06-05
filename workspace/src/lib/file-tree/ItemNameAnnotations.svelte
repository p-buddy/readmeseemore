<script lang="ts" module>
  import type {
    TTreeItem,
    NameEditStatus,
    Root,
  } from "$lib/file-tree/index.js";
  import {
    type TerminalSuggestionAnnotation,
    range,
    TerminalCommands,
  } from "$lib/operating-system/index.js";
  import type { Snippet } from "svelte";

  type NameCheckSeverity = Exclude<NameEditStatus, "valid">;

  const colors = {
    unsafe: "var(--color-yellow-400)",
    invalid: "var(--color-red-400)",
  } satisfies Record<NameCheckSeverity, string>;

  const darken = (key: keyof typeof colors, alpha: number) =>
    `oklch(from ${colors[key]} l c h / ${alpha})`;

  const defaults = {
    style: {
      maxWidth: "max(25%, 20rem)",
      padding: "1rem",
    },
  };

  const styles = {
    unsafe: {
      indicator: {
        style: {
          backgroundColor: colors.unsafe,
        },
      },
      connector: {
        style: {
          color: darken("unsafe", 0.6),
        },
      },
      commentStyle: defaults,
    },
    invalid: {
      indicator: {
        style: {
          backgroundColor: colors.invalid,
        },
      },
      connector: {
        style: {
          color: darken("invalid", 0.6),
        },
      },
      commentStyle: defaults,
    },
  };

  const snippets = {
    notEmpty,
    notWhitespace,
    noTildePrefix,
    noDashPrefix,
    noSpacePrefix,
    noSpaceSuffix,
    forbiddenCharacters,
    discouragedCharacters,
    conflict,
  };

  type SnippetKey = keyof typeof snippets;

  export const snippetNames = Object.keys(snippets) as SnippetKey[];

  const titles = {
    notEmpty: "Empty Error",
    notWhitespace: "Whitespace Error",
    noTildePrefix: "Tilde Error",
    noDashPrefix: "Dash Error",
    noSpacePrefix: "Space Error",
    noSpaceSuffix: "Space Error",
    forbiddenCharacters: "Forbidden Characters",
    discouragedCharacters: "Discouraged Characters",
    conflict: "Already Exists Error",
  } satisfies Record<SnippetKey, string>;

  type ItemType = TTreeItem["type"];
  type CommentProps = {
    type: ItemType;
    snippet: SnippetKey;
    severity: NameCheckSeverity;
  };

  type FileNameAnnotation = TerminalSuggestionAnnotation<CommentProps>;

  const rangeWithOffset = (
    _range: FileNameAnnotation["range"],
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
    const ranges: FileNameAnnotation["range"] = [];
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
    { type }: Pick<TTreeItem, "type">,
    severity: NameCheckSeverity,
    _range: FileNameAnnotation["range"],
    offset: number,
    snippet: SnippetKey,
  ): FileNameAnnotation => ({
    ...styles[severity],
    kind: "highlight",
    range: rangeWithOffset(_range, offset),
    key: snippet,
    comment: wrapper,
    props: { type, snippet, severity },
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
        annotations: [highlight(item, "invalid", 0, offset, "notEmpty")],
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
            "notWhitespace",
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
        highlight(item, "invalid", [0, length], offset, "noTildePrefix"),
      );
    } else if (desired.startsWith("-")) {
      invalid = true;
      const { length } = desired.match(/^-+/)![0];
      skipHead = length;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, length], offset, "noDashPrefix"),
      );
    } else if (desired.startsWith(" ")) {
      invalid = true;
      const { length } = desired.match(/^\s+/)![0];
      skipHead = length;
      (annotations ??= []).push(
        highlight(item, "invalid", [0, length], offset, "noSpacePrefix"),
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
          "noSpaceSuffix",
        ),
      );
    }

    const check = TerminalCommands.CheckFileNameChars(desired);

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
          highlight(item, "invalid", ranges, offset, "forbiddenCharacters"),
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
          highlight(item, "unsafe", ranges, offset, "discouragedCharacters"),
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
        highlight(item, "invalid", [0, desired.length], offset, "conflict"),
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

  export { wrapper };
</script>

{#snippet expand(content: string | Snippet)}
  {#if typeof content === "string"}
    {content}
  {:else}
    {@render content()}
  {/if}
{/snippet}

{#snippet withfootnote(index: number, content: string | Snippet)}
  <span class="whitespace-nowrap">
    <span>
      {@render expand(content)}
    </span><sup>{index}</sup>
  </span>
{/snippet}

{#snippet footnotes(content: (string | Snippet)[], severity: NameCheckSeverity)}
  <div class="opacity-50">
    <hr
      class="h-px my-2 border-0"
      class:bg-red-500={severity === "invalid"}
      class:bg-yellow-500={severity === "unsafe"}
    />
    <div
      class="text-xs"
      class:text-neutral-400={severity === "invalid"}
      class:text-neutral-300={severity === "unsafe"}
    >
      {#each content as item, index}
        <sup>{index + 1}</sup>
        {@render expand(item)}
      {/each}
    </div>
  </div>
{/snippet}

{#snippet anyPath(type: ItemType)}
  a {simplify(type)} (or {other(type)}) path
{/snippet}

{#snippet link(content: string | Snippet, href: string, opacity: number = 1)}
  <a {href} class="text-blue-400 hover:underline" target="_blank" style:opacity>
    {@render expand(content)}
  </a>
{/snippet}

{#snippet code(content: string)}
  <code
    class="inline-block font-mono bg-neutral-800 text-neutral-100 border border-neutral-600 rounded px-1 py-0.25 align-baseline"
  >
    {content}
  </code>
{/snippet}

{#snippet note(content: string | Snippet, severity: NameCheckSeverity)}
  <blockquote
    class="p-2 bg-neutral-900 mt-3 rounded-lg text-red-300 opacity-60 text-xs"
    class:text-yellow-300={severity === "unsafe"}
    class:text-red-300={severity === "invalid"}
  >
    <span class="italic">Note:</span>
    {@render expand(content)}
  </blockquote>
{/snippet}

{#snippet noteOurIssue(severity: NameCheckSeverity)}
  {@render note(
    "This isn't an issue on all computers, but is a limit of our system.",
    severity,
  )}
{/snippet}

{#snippet notEmpty(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot be empty.
{/snippet}

{#snippet notWhitespace(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot be all whitespace (aka spaces, tabs, etc.).
{/snippet}

{#snippet noTildePrefix(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot start with
  {@render code("~")} (called a
  <strong class="italic">tilde</strong>), as it has a
  {@render withfootnote(1, "special meaning")} when it begins
  {@render anyPath(type)}.
  {#snippet specialMeaning()}
    When at the start of {@render anyPath(type)}, the tilde signifies a
    reference to the current user's home directory.
  {/snippet}
  {@render footnotes([specialMeaning], severity)}
{/snippet}

{#snippet noDashPrefix(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot start with a
  <span class="whitespace-nowrap">{@render code("-")} (dash),</span> as that is
  reserved for {@render withfootnote(1, "command line arguments")}. But
  everywhere else dashes are a very safe character to use, and helpful for
  breaking up words (especially instead of spaces, which aren't preferred).
  {#snippet commandLineArguments()}
    <span>Command line arguments</span> are parameters passed to programs
    executed in the terminal. Often programs, like {@render code("mv")}, take
    <span class="italic">positional arguments</span>, so the order in which
    parameters appear after the command name determines their meaning. However,
    other programs take
    <span class="italic">named arguments</span>, which will look like
    {@render code("command --name value")}. For example, {@render code(
      "pizza --size large --topping pineapple",
    )} tells the computer to run the program called {@render code("pizza")} and give
    it two named parameters, one named
    {@render code("size")} with a value of {@render code("large")}, and the
    other named {@render code("topping")} with a value of
    {@render code("pineapple")}. You'll also see programs take
    <span class="italic">shortform</span> named arguments, which use a single
    dash, like {@render code("pizza -s large -t pineapple")}.
  {/snippet}
  {@render footnotes([commandLineArguments], severity)}
{/snippet}

{#snippet noSpacePrefix(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot start with a space, as that can confuse other terminal
  commands.
  {@render noteOurIssue(severity)}
{/snippet}

{#snippet noSpaceSuffix(type: ItemType, severity: NameCheckSeverity)}
  {capitalize(type)} names cannot end with a space, as that can confuse other terminal
  commands.
  {@render noteOurIssue(severity)}
{/snippet}

{#snippet forbiddenCharacters(type: ItemType, severity: NameCheckSeverity)}
  These characters are not allowed in {simplify(type)} names, as they have special
  meaning within the terminal's programming langauge (aka the "shell", which is how
  we talk to the {@render link(
    "operating system",
    "https://en.wikipedia.org/wiki/Operating_system",
  )}).
  {@render note(
    "You might find that not all of these characters are forbidden on other systems.",
    severity,
  )}
{/snippet}

{#snippet discouragedCharacters(type: ItemType, severity: NameCheckSeverity)}
  These characters are discouraged in {simplify(type)} names, as they can make referencing
  a {simplify(type)} in terminal commands more difficult (as you can see it's already
  necessary to wrap the name in double quotes
  <span class="whitespace-nowrap">({@render code('"')}s),</span> and will
  require {@render withfootnote(1, "escaping")} in other commands).
  {#snippet escaping()}
    <span class="italic">Escaping</span> is the process of adding a backslash ({@render code(
      "\\",
    )}) before a character to make it lose its special meaning. For example,
    escaping the {@render code("&")} (ampersand) in an open command looks like: {@render code(
      'open "pb\\&j"',
    )}.
  {/snippet}
  {@render footnotes([escaping], severity)}
{/snippet}

{#snippet conflict(type: ItemType, severity: NameCheckSeverity)}
  A {simplify(type)} already exists with this name.
{/snippet}

{#snippet wrapper({ type, snippet, severity }: CommentProps)}
  {#if severity === "invalid"}
    <div
      class="p-4 border-1 rounded-lg bg-neutral-800 text-red-400 border-red-800"
      role="alert"
    >
      <div class="flex items-center">
        <svg
          aria-hidden="true"
          class="shrink-0 w-4 h-4 me-2"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.91 3.23 3.23 7.913v-.01a.81.81 0 0 0-.23.57v7.054c0 .22.08.42.23.57L7.9 20.77c.15.15.36.23.57.23h7.06c.22 0 .42-.08.57-.23l4.67-4.673a.81.81 0 0 0 .23-.57V8.473c0-.22-.08-.42-.23-.57L16.1 3.23a.81.81 0 0 0-.57-.23H8.48c-.22 0-.42.08-.57.23ZM12 7a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm-1 9a1 1 0 0 1 1-1h.008a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1Z"
              fill="currentColor"
            />
          </g>
        </svg>
        <span class="sr-only">Error</span>
        <h3 class="text-lg font-medium">{titles[snippet]}</h3>
      </div>
      <div class="m-2 text-sm">
        {@render snippets[snippet](type, severity)}
      </div>
    </div>
  {:else}
    <div
      class="p-4 border-1 rounded-lg bg-neutral-800 text-yellow-300 border-yellow-800"
      role="alert"
    >
      <div class="flex items-center">
        <svg
          aria-hidden="true"
          class="shrink-0 w-4 h-4 me-2"
          viewBox="0 0 512 512"
          xmlns="http://www.w3.org/2000/svg"
          fill="#000000"
        >
          <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
            <g fill="currentColor" transform="translate(32.000000, 42.666667)">
              <path
                d="M246.312928,5.62892705 C252.927596,9.40873724 258.409564,14.8907053 262.189374,21.5053731 L444.667042,340.84129 C456.358134,361.300701 449.250007,387.363834 428.790595,399.054926 C422.34376,402.738832 415.04715,404.676552 407.622001,404.676552 L42.6666667,404.676552 C19.1025173,404.676552 7.10542736e-15,385.574034 7.10542736e-15,362.009885 C7.10542736e-15,354.584736 1.93772021,347.288125 5.62162594,340.84129 L188.099293,21.5053731 C199.790385,1.04596203 225.853517,-6.06216498 246.312928,5.62892705 Z M224,272 C208.761905,272 197.333333,283.264 197.333333,298.282667 C197.333333,313.984 208.415584,325.248 224,325.248 C239.238095,325.248 250.666667,313.984 250.666667,298.624 C250.666667,283.264 239.238095,272 224,272 Z M245.333333,106.666667 L202.666667,106.666667 L202.666667,234.666667 L245.333333,234.666667 L245.333333,106.666667 Z"
              />
            </g>
          </g>
        </svg>
        <span class="sr-only">Warning</span>
        <h3 class="text-lg font-medium">{titles[snippet]}</h3>
      </div>
      <div class="m-2 text-sm">
        {@render snippets[snippet](type, severity)}
      </div>
    </div>
  {/if}
{/snippet}
