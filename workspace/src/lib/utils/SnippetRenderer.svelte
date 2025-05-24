<script lang="ts" module>
  import type { Snippet } from "svelte";

  type Props<TSnippet extends Snippet<[TProps]>, TProps> = {
    snippet: TSnippet;
    props: TProps;
  };
</script>

<script lang="ts" generics="T extends Snippet<[TProps]>, TProps">
  let { snippet, props }: Props<T, TProps> = $props();
</script>

{@render snippet(props)}
