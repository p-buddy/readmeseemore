<script lang="ts">
  import { Sweater } from "sweater-vest";
  import Workspace from "$lib/Workspace.svelte";
  import { defer } from "$lib/utils/index.js";
  import contents from "./dummy.ts?raw";
  import stripAnsi from "strip-ansi";
</script>

<Sweater
  body={async ({ given, set }) => {
    let ready = $state(false);
    const onReady = defer<boolean>();
    set({
      onReady: () => onReady.resolve((ready = true)),
    });
    set(() => ({ ready }));
    const { workspace } = await given("workspace");
    await onReady.promise;
    const os = workspace.OS();

    const port = 6000;
    const onServer = defer<{ port: number; url: string }>();

    os.container.on("server-ready", async (_port, url) => {
      if (_port === port) onServer.resolve({ port, url });
    });

    const proc = await os.container.spawn("npx", [
      "--yes",
      "@readmeseemore/svelte-language-server",
      `${port}`,
      "--verbose",
    ]);

    const reader = proc.output.getReader();
    reader.read().then(function read({ done, value }): any {
      if (value) console.log(stripAnsi(value));
      if (done) return;
      return reader.read().then(read);
    });

    await Promise.all([
      os.enqueueCommand(
        "npm install vscode-jsonrpc vscode-ws-jsonrpc ws",
        true,
      ),
      onServer.promise,
    ]);

    os.enqueueCommand("npx --yes tsx index.ts");
  }}
>
  {#snippet vest(pocket: {
    workspace: Workspace;
    ready: boolean;
    onReady: () => void;
  })}
    <div class="w-screen h-screen">
      {#if !pocket.ready}
        <div>Loading...</div>
      {/if}

      <Workspace
        bind:this={pocket.workspace}
        onReady={pocket.onReady}
        filesystem={{
          "index.ts": {
            file: {
              contents,
            },
          },
        }}
      />
    </div>
  {/snippet}
</Sweater>

<style>
  :root {
    color-scheme: dark;
  }
</style>
