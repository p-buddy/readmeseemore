<script lang="ts">
  import { fade } from "svelte/transition";
  import Overlapping from "./Overlapping.svelte";

  type Props = {
    canStart: boolean;
    canSkip: boolean;
    onStart: () => void;
    onSkip: () => void;
  };
  let {
    canStart: externalCanStart,
    canSkip,
    onStart,
    onSkip,
  }: Props = $props();
  let files = $state<FileList>();

  let canStart = $derived(externalCanStart && (files?.length ?? 0) === 0);
</script>

<div class="w-full">
  <h3
    class="mb-4 text-3xl font-extrabold tracking-tight leading-none text-gray-900 dark:text-white w-full flex flex-row justify-between"
  >
    <div>
      <span class="feed-me text-red-500">Feed me</span> your markdown
    </div>

    <button
      class="relative inline-flex items-center justify-center p-0.5 mb-2 me-2 overflow-hidden text-sm font-medium text-gray-900 rounded-full group bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 group-hover:from-blue-500 group-hover:to-blue-700 hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
    >
      <span
        class="text-blue-500 relative px-5 py-2 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-full group-hover:bg-transparent group-hover:dark:bg-transparent hover:text-white"
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
          class="rounded-e-lg bg-gray-50 border border-e-0 border-gray-300 text-gray-500 dark:text-gray-400 text-sm border-s-0 focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500"
        />
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
      class="flex flex-col items-center justify-center w-full h-20 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600"
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
      <input id="dropzone-file" type="file" class="hidden" bind:files />
    </label>
  </div>
  <div></div>
  <div class="w-full flex flex-row items-center justify-center gap-2 mt-4">
    <Overlapping>
      {@const common =
        "text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"}
      {#if canStart}
        <button
          type="button"
          class="{common} hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800"
          in:fade
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
</style>
