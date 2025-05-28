<script lang="ts">
  import { Sweater } from "sweater-vest";
  import { testTerminal } from "../harness.js";
</script>

{#snippet annotation()}
  <div class="flex flex-col max-w-100 text-wrap">
    <div>
      By the grace of Shaddam IV of House Corrino, ascendant to the Golden Lion
      Throne of Padishah Emperor of the Known Universe, I stand before you as
      Herald of the Change. We're witnessed by members of the Imperial Court,
      representatives of the Spacing Guild and a sister of the Bene Gesserit.
      The Emperor has spoken! House Atreides shall immediately take control of
      Arrakis and serve as its steward! Do you accept?
    </div>
    <div>Your seal?</div>
    <div>So, it's done?</div>
    <div>It's done.</div>
  </div>
{/snippet}

<Sweater
  containerIndex={0}
  body={async ({ given }) => {
    const { terminal } = await testTerminal();
    const { container } = await given("container");
    terminal.mount(container);
    const suggestion = await terminal.suggestAndWait(
      "command with suggestion",
      true,
      false,
    );
    await suggestion.exports.visible(false, true);
    await suggestion.exports.visible(true);
    suggestion.exports.update("command with suggestion", [
      {
        key: annotation.name,
        comment: annotation,
        kind: "highlight",
        range: [0, "command".length],
        props: null as any,
      },
    ]);
  }}
>
  {#snippet vest(pocket: { container: HTMLDivElement })}
    <div
      class="w-full h-screen flex items-center align-bottom justify-center m-0"
    >
      <div class="w-1/2 h-1/4" bind:this={pocket.container}></div>
    </div>
  {/snippet}
</Sweater>
