<script lang="ts">
  import { OperatingSystem } from "$lib/operating-system/index.js";
  import { Sweater } from "sweater-vest";
  import "@xterm/xterm/css/xterm.css";
</script>

<Sweater
  body={async (harness) => {
    let fn: (() => void) | undefined;
    harness.set({
      onclick: () => fn?.(),
    });
    const os = await OperatingSystem.Create({
      filesystem: {
        file: { file: { contents: "" } },
        dir: { directory: { file: { file: { contents: "" } } } },
      },
      force: true,
    });

    const terminal = os.terminals[0];

    const { container } = await harness.given("container");

    terminal.xterm.open(container);
    os.terminal.fit();
    await os.terminal.inputReady;

    await new Promise((resolve) => setTimeout(resolve, 4000));

    const first = terminal.enqueueCommand("touch hi.txt", true);
    const third = terminal.enqueueCommand("ls", true);
    const second = terminal.enqueueCommand("rm hi.txt", true);
    first.then((result) => {
      console.log(result);
    });

    terminal.commandQueue.onEmpty.then(() => {
      console.log("queue empty");
    });
  }}
>
  {#snippet vest(pocket: { container: HTMLDivElement; onclick: () => void })}
    <div class="w-screen h-screen flex flex-col">
      <div class="flex-1" bind:this={pocket.container}></div>
    </div>
  {/snippet}
</Sweater>
