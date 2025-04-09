<script lang="ts" module>
  const toFile = (contents: string) => ({
    file: {
      contents,
    },
  });

  class Params {
    private readonly entries: [string, string][];
    constructor(searchParams: URLSearchParams) {
      this.entries = Array.from(searchParams.entries());
    }

    get(key: string) {
      const result = this.entries
        .filter(([k]) => k === key)
        .flatMap(([_, v]) => v.split(","));
      return result.length > 0 ? result : undefined;
    }
  }
</script>

<script lang="ts">
  import { Workspace } from "@readmeseemore/workspace";
  import { page } from "$app/state";
  import { untrack } from "svelte";
  import MarkdownEntry from "$lib/MarkdownEntry.svelte";
  import { untilFontsLoaded } from "$lib";
  import Startup from "$lib/Startup.svelte";
  import { fly } from "svelte/transition";
  import { multiparse, mergeFilesystems } from "@readmeseemore/parser";

  let workspace = $state<Workspace>();
  let workspaceReady = $state(false);
  let showWorkspace = $state(false);

  let steps = $state<string[]>([]);

  const params = new Params(page.url.searchParams);

  const links = params.get("link");
  const ids = params.get("id");

  const dependencies = params.get("pkg")?.reduce(
    (acc, specifier) => {
      let [name, version] = specifier.trim().split("@");
      acc[name] = version || "latest";
      return acc;
    },
    {} as Record<string, string>,
  );
  const initialFs = dependencies
    ? {
        "package.json": toFile(JSON.stringify({ dependencies })),
      }
    : undefined;

  let fontsLoaded = $state(links ? true : false);

  // svelte-ignore state_referenced_locally
  if (!fontsLoaded)
    untilFontsLoaded("Rusty Attack").then((loaded) => (fontsLoaded = loaded));
</script>

<svelte:head>
  <link
    rel="preload"
    href="/rusty-attack-demo.regular.otf"
    as="font"
    type="font/otf"
  />
</svelte:head>

<div class="w-screen h-screen flex flex-col">
  <div></div>
  <div
    class="flex-1 opacity-0 transition-opacity duration-500"
    class:opacity-100={workspaceReady}
  >
    <Workspace
      bind:this={workspace}
      filesystem={initialFs}
      status={(status) => untrack(() => steps.push(status))}
      onReady={() => (workspaceReady = true)}
    />
  </div>
  <div></div>
  {#if !showWorkspace}
    <div
      class="absolute top-0 left-0 w-full h-full bg-black/50 z-10 opacity-0 transition-opacity duration-200"
      class:opacity-100={fontsLoaded}
      out:fly
    >
      <div
        class="w-3/5 m-auto h-full flex flex-col gap-6 items-center justify-center"
      >
        {#if !links}
          <div class="w-full">
            <MarkdownEntry
              canStart={workspaceReady}
              canSkip={workspaceReady}
              onStart={async (promise) => {
                showWorkspace = true;
                const contents = await promise;
                const { filesystem, errors, startup } = ids
                  ? multiparse(contents, ...ids)
                  : multiparse(contents);
                if (initialFs)
                  mergeFilesystems({
                    target: filesystem,
                    source: initialFs,
                    errors,
                  });
                await workspace!.updateFilesystem(filesystem);
                if (startup)
                  for (const command of startup.split("\n"))
                    workspace!.OS().enqueueCommand(command);
                else if (await workspace?.readFile("package.json"))
                  workspace!.OS().enqueueCommand("npm install");
              }}
              onSkip={() => (showWorkspace = true)}
            />
          </div>
        {/if}
        <div class="w-full">
          <Startup completed={workspaceReady} messages={steps} />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @font-face {
    font-family: "Rusty Attack";
    src: url("/rusty-attack-demo.regular.otf");
  }

  :global(.rusty-attack) {
    font-family: "Rusty Attack";
  }
</style>
