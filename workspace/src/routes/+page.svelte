<script>
  import Workspace from "$lib/Workspace.svelte";
</script>

<div class="w-screen h-screen">
  <Workspace
    onReady={() => {
      console.log("ready");
    }}
  />
</div>
