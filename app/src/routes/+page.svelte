<script lang="ts">
  import Main from "$lib/Main.svelte";
  import { Dock } from "$lib/vslite/components/Dock";
  import { sveltify } from "@p-buddy/svelte-preprocess-react";
  const react = sveltify({ Dock });
</script>

<div class="h-full w-full flex flex-col">
  <div class="h-10 w-full bg-gray-200"></div>
  <div class="w-full m-0 overscroll-none flex-grow">
    <!--react.Dock />-->
    <Main />
  </div>
</div>
