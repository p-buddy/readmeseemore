<script lang="ts">
  let { hi = $bindable() } = $props();

  hi = () => {
    console.log("hi");
  };
</script>
