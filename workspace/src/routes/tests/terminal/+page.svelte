<script lang="ts">
  import OperatingSystem from "$lib/OperatingSystem.js";
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

    const { xterm, jsh } = os;

    const { container } = await harness.given("container");

    xterm.open(container);
    os.fitXterm();
    fn = () => {
      os.enqueue("curl https://httpbin.org/delay/1");
      os.enqueue("echo 'hello'");
      os.onQueueEmpty.then(() => {
        console.log("queue empty");
      });
    };
  }}
>
  {#snippet vest(pocket: { container: HTMLDivElement; onclick: () => void })}
    <div class="w-screen h-screen flex flex-col">
      <div class="flex-1" bind:this={pocket.container}></div>
      <button onclick={pocket.onclick}>run</button>
    </div>
  {/snippet}
</Sweater>
