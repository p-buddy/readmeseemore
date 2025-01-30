<script
  lang="ts"
  generics="
    T extends [PanelPropsByView<Params>[keyof PanelPropsByView]],
    Params extends { [index: string]: any; }
  "
>
  import type { Snippet } from "svelte";
  import type { PanelPropsByView } from "./utils.svelte";

  let {
    params: paramsWithSnippet,
    api,
    containerApi,
  }: PanelPropsByView<{
    snippet: Snippet<T>;
  }>[keyof PanelPropsByView] = $props();

  type Arg = T[0];
  type Args = [Arg];
  type Fn = (...args: Args) => ReturnType<Snippet<Args>>;

  let { snippet, ...params } = paramsWithSnippet;

  let arg = $derived({ params, api, containerApi }) as Arg;
</script>

<div>
  {@render (snippet as Fn)(arg)}
</div>
