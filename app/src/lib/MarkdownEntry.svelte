<script lang="ts" module>
  const identify = ({ name, size, lastModified }: File) =>
    name + size + lastModified;

  const validateURL = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  };
</script>

<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import Overlapping from "./Overlapping.svelte";
  import { untrack } from "svelte";
  import { flip } from "svelte/animate";
  import LoadingToCheck from "./LoadingToCheck.svelte";

  type Props = {
    canStart: boolean;
    canSkip: boolean;
    onStart: (content: Promise<string[]>) => void;
    onSkip: () => void;
  };
  let {
    canStart: externalCanStart,
    canSkip,
    onStart,
    onSkip,
  }: Props = $props();

  let url = $state("");
  let valid = $state(false);
  let controller: AbortController | undefined;

  const response = $derived.by<Promise<string> | undefined>(() => {
    controller?.abort();
    untrack(() => (valid = false));

    if (!url || !validateURL(url)) {
      controller = undefined;
      return url ? Promise.reject("Invalid URL") : undefined;
    }

    controller = new AbortController();
    return fetch(url, controller)
      .then((response) => response.text())
      .then((text) => {
        untrack(() => (valid = true));
        return text;
      });
  });

  let files = $state<FileList>();
  let uploads = $state<File[]>([]);

  const texts = new Map<ReturnType<typeof identify>, Promise<string>>();

  $effect(() => {
    for (let i = 0; i < (files?.length ?? 0); i++) {
      const file = files![i];
      const id = identify(file);
      texts.set(id, file.text());
      untrack(() => {
        if (uploads.some((upload) => identify(upload) === id)) return;
        uploads.push(file);
      });
    }
    uploads = uploads;
  });

  let canStart = $derived(
    externalCanStart && (valid || (uploads?.length ?? 0) > 0),
  );

  const start = async () => {
    const promises = uploads.map(
      (file) => texts.get(identify(file)) ?? file.text(),
    );
    if (response) promises.push(response);
    onStart(Promise.all(promises));
  };

  let dropping = $state(false);
</script>

<div class="w-full">
  <h3
    class="mb-4 text-3xl font-extrabold tracking-tight leading-none text-gray-900 dark:text-white w-full flex flex-row justify-between items-center"
  >
    <div>
      <span class="feed-me text-red-500">Feed me</span> your markdown
    </div>

    <button
      class="relative inline-flex items-center justify-center p-0.5 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-full group bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 group-hover:from-blue-500 group-hover:to-blue-700 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
    >
      <span
        class="text-blue-500 relative px-3 py-1 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-full group-hover:bg-transparent group-hover:dark:bg-transparent hover:text-white"
      >
        What is this?
      </span>
    </button>
  </h3>

  <div class="w-full">
    <div class="flex items-center w-full">
      <span
        class="shrink-0 z-10 inline-flex items-center py-2.5 px-4 text-sm font-medium text-center text-gray-900 bg-gray-100 border border-gray-300 rounded-s-lg dark:bg-gray-600 dark:text-white dark:border-gray-600"
      >
        URL
      </span>
      <div class="relative flex-1">
        <input
          id="website-url"
          type="text"
          aria-describedby="helper-text-explanation"
          class="pr-8 rounded-e-lg bg-gray-50 border border-e-0 border-gray-300 text-gray-500 dark:text-gray-400 text-sm border-s-0 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
          bind:value={url}
        />
        {#if response}
          <div
            class="absolute right-2 top-0 h-full w-4 flex items-center"
            in:fade={{ duration: 300 }}
            out:fade={{ duration: 300 }}
          >
            <Overlapping>
              {#await response}
                <LoadingToCheck checked={false} size={4} />
              {:then _}
                <LoadingToCheck checked={true} size={4} />
              {:catch error}
                <div
                  class="has-tooltip text-red-500 overflow-visible"
                  in:fade={{ duration: 300 }}
                  out:fade={{ duration: 300 }}
                >
                  <span
                    class="tooltip rounded shadow-lg p-1 bg-gray-100 text-red-500 -mt-8 max-w-screen whitespace-nowrap right-0"
                  >
                    {error}
                  </span>
                  <svg
                    class="shrink-0 w-4 text-red-500"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM9.5 4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM12 15H8a1 1 0 0 1 0-2h1v-3H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1v4h1a1 1 0 0 1 0 2Z"
                    />
                  </svg>
                </div>
              {/await}
            </Overlapping>
          </div>
        {/if}
      </div>
    </div>
  </div>
  <div class="inline-flex items-center justify-center w-full">
    <hr class="w-64 h-px my-6 bg-gray-200 border-0 dark:bg-gray-700" />
    <span
      class="absolute px-3 font-medium text-gray-900 -translate-x-1/2 left-1/2 dark:text-white"
    >
      or
    </span>
  </div>
  <div class="flex items-center justify-center w-full">
    <label
      for="dropzone-file"
      ondragover={(e) => (e.preventDefault(), (dropping = true))}
      ondragleave={() => (dropping = false)}
      ondrop={(e) => {
        e.preventDefault();
        dropping = false;
        files = e.dataTransfer?.files;
      }}
      class="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
      class:dark:border-white={dropping}
    >
      <div class="flex flex-col items-center justify-center pt-2">
        <svg
          class="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400"
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 20 16"
        >
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
          />
        </svg>
        <p class="mb-2 text-sm text-gray-500 dark:text-gray-400">
          <span class="font-semibold">Click to upload</span> or drag and drop
        </p>
      </div>
      <input
        id="dropzone-file"
        type="file"
        class="hidden"
        bind:files
        multiple
        accept=".md,.markdown"
      />
    </label>
  </div>
  <div
    class="max-h-0 overflow-y-clip transition-all duration-500 mt-2"
    class:max-h-100={uploads.length > 0}
  >
    {#each uploads as file, index (identify(file))}
      <span
        id="badge-dismiss-dark"
        class="inline-flex items-center px-2 py-1 me-2 text-sm mt-2 font-medium text-gray-800 bg-gray-100 rounded-sm dark:bg-gray-700 dark:text-gray-300"
        in:scale
        out:scale
        animate:flip={{ duration: 300 }}
      >
        {file.name}
        <button
          type="button"
          class="inline-flex items-center p-1 ms-2 text-sm text-gray-400 bg-transparent rounded-xs hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600 dark:hover:text-gray-300"
          data-dismiss-target="#badge-dismiss-dark"
          aria-label="Remove"
          onclick={() => {
            texts.delete(identify(file));
            uploads.splice(index, 1);
          }}
        >
          <svg
            class="w-2 h-2"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 14 14"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
            />
          </svg>
          <span class="sr-only">Remove File</span>
        </button>
      </span>
    {/each}
  </div>
  <div class="w-full flex flex-row items-center justify-center gap-2 mt-4">
    <Overlapping>
      {@const common =
        "text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"}
      {#if canStart}
        <button
          type="button"
          class="{common} hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
          in:fade
          onclick={start}
        >
          Start
        </button>
      {:else}
        <button
          type="button"
          disabled
          class="{common} opacity-50 cursor-not-allowed"
          out:fade
        >
          Start
        </button>
      {/if}
    </Overlapping>

    <Overlapping>
      {@const common =
        "py-2.5 px-5 me-2 mb-2 text-sm font-medium text-gray-900 bg-white rounded-lg border border-gray-200 focus:z-10 focus:ring-4 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600"}
      {#if canSkip}
        <button
          type="button"
          class="{common} focus:outline-none hover:bg-gray-100 hover:text-blue-700 focus:ring-gray-100 dark:focus:ring-gray-700 dark:hover:text-white dark:hover:bg-gray-700"
          onclick={onSkip}
        >
          Skip
        </button>
      {:else}
        <button
          type="button"
          class="{common} opacity-50 cursor-not-allowed"
          disabled
        >
          Skip
        </button>
      {/if}
    </Overlapping>
  </div>
</div>

<style>
  .feed-me {
    font-family: "Rusty Attack";
    margin-right: 0.25rem;
  }

  .tooltip {
    @apply invisible absolute;
  }

  .has-tooltip:hover .tooltip {
    @apply visible z-50;
  }
</style>
