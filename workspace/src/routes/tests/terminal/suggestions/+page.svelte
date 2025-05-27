<script lang="ts">
  import { Sweater } from "sweater-vest";
  import { testTerminal } from "../harness.js";
</script>

<Sweater
  body={async ({ given }) => {
    const { terminal, write } = await testTerminal();
    const { container } = await given("container");
    //terminal.mount(container);
    await write("echo ''");
  }}
>
  {#snippet vest(pocket: { container: HTMLDivElement })}
    <div
      class="w-full h-screen flex items-center align-bottom justify-center m-0"
    >
      <div class="w-1/4 h-1/4" bind:this={pocket.container}></div>
    </div>
  {/snippet}
</Sweater>
