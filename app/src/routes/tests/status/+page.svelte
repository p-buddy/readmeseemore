<script lang="ts">
  import LoadingToCheck from "$lib/LoadingToCheck.svelte";
  import Status from "$lib/Status.svelte";
  import { Sweater } from "sweater-vest";
</script>

<Sweater
  body={async ({ set }) => {
    let messages = $state<string[]>(["hi"]);
    let completed = $state(false);
    set(() => ({ messages }));
    set(() => ({ completed }));
    while (messages.length < 10) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      messages.push("hi2");
    }
    completed = true;
  }}
>
  {#snippet vest({
    messages,
    completed,
  }: {
    messages: string[];
    completed: boolean;
  })}
    <div class="w-full h-40">
      <Status {messages} {completed} />
    </div>
    <div class="w-full h-2 bg-red-500"></div>
  {/snippet}
</Sweater>

<Sweater
  body={async ({ set }) => {
    let checked = $state(false);
    set(() => ({ checked }));
    await new Promise((resolve) => setTimeout(resolve, 500));
    checked = true;
  }}
>
  {#snippet vest({ checked }: { checked: boolean })}
    <LoadingToCheck {checked} />
  {/snippet}
</Sweater>
