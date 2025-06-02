<script lang="ts">
  import type { TerminalSuggestionAnnotation } from "$lib/operating-system/index.js";
  import { Sweater } from "sweater-vest";
  import { testTerminal } from "../harness.js";

  const randomBetween = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const randomSubset = <T,>(arr: T[], count?: number): T[] => {
    const k =
      count === undefined
        ? Math.floor(Math.random() * arr.length) + 1
        : Math.trunc(count);

    const shuffled = arr.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, k);
  };

  const randomSubstring = (str: string, minLength?: number): string => {
    minLength ??= str.length / 2;
    minLength = Math.min(minLength, str.length);

    let end = Math.floor(Math.random() * str.length) + 1;
    let start = Math.floor(Math.random() * (str.length - end));

    while (end - start < minLength) {
      end = Math.min(end + 1, str.length);
      start = Math.max(start - 1, 0);
    }

    return str.slice(start, end);
  };

  const dune = [
    [
      "By the grace of Shaddam IV of House Corrino, ascendant to the Golden",
      "Lion Throne of Padishah Emperor of the Known Universe, I stand before",
      "you as Herald of the Change. We're witnessed by members of the Imperial",
      "Court, representatives of the Spacing Guild and a sister of the Bene",
      "Gesserit. The Emperor has spoken! House Atreides shall immediately take",
      "control of Arrakis and serve as its steward! Do you accept?",
    ].join(" "),
    "Your seal?",
    "So, it's done?",
    "It's done.",
  ];

  const toRender = () => {
    const result = dune
      .map((p) => randomSubstring(p, 10))
      .filter(() => Math.random() < 0.5);
    return result.length > 0 ? result : dune[randomBetween(0, dune.length - 1)];
  };
</script>

{#snippet randomSubsection()}
  {#each toRender() as line}
    <div class="bg-red-500">
      {line}
    </div>
  {/each}
{/snippet}

{#snippet annotation()}
  <div class="flex flex-col w-100 border-1 m-2 p-2 text-wrap">
    {@render randomSubsection()}
  </div>
{/snippet}

<Sweater
  containerIndex={0}
  body={async ({ given }) => {
    const { terminal } = await testTerminal();
    const { container } = await given("container");
    terminal.mount(container);
    const text = "command with suggestion";
    const suggestion = await terminal.suggestAndWait(text, true, false);
    await suggestion.exports.visible(false, true);
    await suggestion.exports.visible(true);

    let acc = 0;
    const annotations = text.split("").map(
      (word, index) =>
        ({
          key: index,
          comment: annotation,
          kind: "highlight",
          range: [index, index + 1],
          props: null as any,
        }) satisfies TerminalSuggestionAnnotation<undefined, true>,
    );
    /* 
    while (true) {
      for (const annotation of annotations) {
        suggestion.exports.update(text, [annotation]);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } */

    setInterval(() => {
      //suggestion.exports.update(text);
      setTimeout(() => {
        suggestion.exports.update(
          text,
          randomSubset(annotations, randomBetween(3, 7)),
        );
      }, 100);
    }, 1000);
  }}
>
  {#snippet vest(pocket: { container: HTMLDivElement })}
    <div class="w-full h-screen flex items-end align-bottom justify-center m-0">
      <div class="w-1/2 h-1/4" bind:this={pocket.container}></div>
    </div>
  {/snippet}
</Sweater>
