<script lang="ts" module>
  export type Props = {
    inMs: number;
    outMs: number;
    content: string;
  };

  /** from inline style of element with class "xterm-viewport" */
  const bg = "rgb(24, 24, 24)";

  const fillChars = <T,>(content: string, chars: T[]) => {
    for (let i = chars.length; i < content.length; i++)
      chars.push(undefined as T);
    chars.length = content.length;
  };

  const isSingleRange = (
    ranges: Required<Annotation>["ranges"],
  ): ranges is [number, number] => !Array.isArray(ranges[0]);
</script>

<script lang="ts">
  import type { Annotation } from "$lib/file-tree/ItemNameAnnotations.svelte";

  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

  let annotations = $state<Annotation[]>();

  export const visible = <AwaitComplete extends true | undefined = undefined>(
    condition: boolean,
    awaitComplete?: AwaitComplete,
  ) => {
    isVisible = condition;
    type Return = AwaitComplete extends true ? Promise<void> : void;
    if (!awaitComplete) return void 0 as Return;
    const delay = (condition ? inMs : outMs) + 1;
    return new Promise((resolve) => setTimeout(resolve, delay)) as Return;
  };

  const chars = new Array<HTMLSpanElement>();
  fillChars(content, chars);

  export const update = (_content: string, _annotations?: Annotation[]) => {
    content = _content;
    fillChars(content, chars);
    annotations = _annotations;
  };

  let container: HTMLDivElement;

  let annotationBorders = new Array<HTMLDivElement>();

  const border = ([start, end]: [number, number], rect: DOMRect) => {
    const startRect = chars[start].getBoundingClientRect();
    const endRect = chars[end - 1].getBoundingClientRect();

    const border = document.createElement("div");
    container.appendChild(border);
    border.style.position = "absolute";
    border.style.left = `${startRect.left - rect.left}px`;
    border.style.width = `${endRect.right - startRect.left}px`;
    border.style.top = `0px`;
    border.style.height = `${rect.height}px`;
    border.style.outline = "1px solid red";
    annotationBorders.push(border);
  };

  $effect(() => {
    for (const border of annotationBorders) border.remove();
    annotationBorders.length = 0;
    if (!annotations) return;
    const rect = container.getBoundingClientRect();
    for (const annotation of annotations) {
      const { ranges } = annotation;
      if (!ranges) continue;
      if (isSingleRange(ranges)) border(ranges, rect);
      else for (const range of ranges) border(range, rect);
    }
  });
</script>

<div
  bind:this={container}
  style:background-color={bg}
  style:color={"rgb(150, 150, 150)"}
  style:transition-duration={!isVisible ? `${outMs}ms` : `${inMs}ms`}
  class:opacity-100={isVisible}
  class:opacity-0={!isVisible}
  class="absolute left-0 top-0 xterm-rows italic text-neutral-600"
>
  <span> <!-- space for left margin, same as how xterm does it --></span>
  {#each content as char, index}
    <span bind:this={chars[index]}>
      {char}
    </span>
  {/each}
</div>
