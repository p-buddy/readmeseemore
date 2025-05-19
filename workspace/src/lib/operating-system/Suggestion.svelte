<script lang="ts" module>
  export type Props = {
    inMs: number;
    outMs: number;
    content: string;
  };

  /** from inline style of element with class "xterm-viewport" */
  const bg = "rgb(24, 24, 24)";
</script>

<script lang="ts">
  let { content, inMs, outMs }: Props = $props();

  let isVisible = $state(false);

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

  export const update = (_content: string) => {
    content = _content;
  };
</script>

<div
  style:background-color={bg}
  style:color={"rgb(150, 150, 150)"}
  style:transition-duration={!isVisible ? `${outMs}ms` : `${inMs}ms`}
  class:opacity-100={isVisible}
  class:opacity-0={!isVisible}
  class="absolute left-0 top-0 xterm-rows italic text-neutral-600"
>
  <span> <!-- space for left margin, same as how xterm does it --></span>
  <span>{content}</span>
</div>
