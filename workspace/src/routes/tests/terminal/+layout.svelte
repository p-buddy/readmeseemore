<script lang="ts">
  import "@xterm/xterm/css/xterm.css";
  let { children } = $props();
</script>

{@render children()}

<style>
  :root {
    color-scheme: dark;
  }
</style>
