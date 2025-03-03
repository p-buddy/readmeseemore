<script lang="ts">
  import Vest from "../Vest.svelte";
</script>

{#each [1, 2, 3] as i}
  <Vest
    body={async (harness) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }}
  >
    {#snippet vest()}
      {i}
    {/snippet}
  </Vest>
{/each}

{#each [1, 2, 3].map((i) => i + 3) as i}
  <Vest
    mode="parallel"
    body={async (harness) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }}
  >
    {#snippet vest()}
      {i}
    {/snippet}
  </Vest>
{/each}
