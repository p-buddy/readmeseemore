<script lang="ts" module>
  type Props = {
    parent: HTMLElement;
    points?: Point[];
    width?: number;
    smoothing?: number;
    durationMs?: number;
    class?: string;
    style?: string;
  };

  const toHalfPixel = {
    round: (value: number) => Math.round(value * 2) / 2,
    ceil: (value: number) => Math.ceil(value * 2) / 2,
    floor: (value: number) => Math.floor(value * 2) / 2,
  };

  const splitPath = (d: string) => d.match(/[a-zA-Z][^a-zA-Z]*/g) ?? [];

  const withPadding = (commands: string[], length: number) => {
    const last = commands[commands.length - 1];
    while (commands.length < length) commands.push(last);
    return commands.join("");
  };

  const smil = (animate: SVGAnimateElement, from: string, to: string) => {
    animate.setAttribute("from", from);
    animate.setAttribute("to", to);
    animate.beginElement();
  };

  const dedupe = (commands: string[]) => {
    const { length } = commands;
    const last = commands[length - 1];
    while (length > 1 && commands[length - 2] === last) commands.pop();
    return commands.length < length;
  };

  const morph = (
    path: SVGPathElement,
    animate: SVGAnimateElement,
    to: string,
  ) => {
    let from = path.getAttribute("d");

    if (!from) {
      path.setAttribute("d", to);
      return;
    }

    if (from === to) return;

    const froms = splitPath(from);
    const tos = splitPath(to);

    if (dedupe(froms)) path.setAttribute("d", from);

    if (froms.length < tos.length) {
      const from = withPadding(froms, tos.length);
      path.setAttribute("d", from);
      requestAnimationFrame(() => smil(animate, from, to));
    } else if (froms.length > tos.length) {
      to = withPadding(tos, froms.length);
      smil(animate, from, to);
    } else smil(animate, from, to);
  };

  const bounds = (points: Point[]) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
      if (point.x < minX) minX = point.x;
      if (point.x > maxX) maxX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.y > maxY) maxY = point.y;
    }

    return {
      x: toHalfPixel.floor(minX - 1),
      y: toHalfPixel.floor(minY - 1),
      width: toHalfPixel.ceil(maxX - minX + 2),
      height: toHalfPixel.ceil(maxY - minY + 2),
    };
  };

  const localize = (points: Point[], bbox: ReturnType<typeof bounds>) =>
    points.map(({ x, y }) => ({
      x: toHalfPixel.round(x - bbox.x),
      y: toHalfPixel.round(y - bbox.y),
    }));
</script>

<script lang="ts">
  import { createSvgPath } from "./third-party/svg.js";
  import type { Point } from "./third-party/types.js";

  let {
    points,
    parent,
    smoothing = 0,
    width = 3,
    durationMs = 250,
    ...rest
  }: Props = $props();

  const origin = $derived(parent.getBoundingClientRect());

  let bounding = $state({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  export const update = (points: Point[]) => {
    if (!animate || !path) return requestAnimationFrame(() => update(points));
    bounding = bounds(points);
    const d = createSvgPath(localize(points, bounding), smoothing);
    morph(path, animate, d);
  };

  $effect(() => {
    if (points) update(points);
  });

  let animate: SVGAnimateElement;
  let path: SVGPathElement;
</script>

<div
  {...rest}
  style:position="absolute"
  style:width={`${bounding.width}px`}
  style:height={`${bounding.height}px`}
  style:left={`${bounding.x - origin.x}px`}
  style:top={`${bounding.y - origin.y}px`}
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="100%"
    height="100%"
    viewBox={`0 0 ${bounding.width} ${bounding.height}`}
  >
    <path
      bind:this={path}
      stroke-linecap="butt"
      stroke-width={width}
      stroke="red"
      vector-effect="non-scaling-stroke"
    />
    <animate
      bind:this={animate}
      attributeName="d"
      dur={`${durationMs}ms`}
      fill="freeze"
      begin="indefinite"
    />
  </svg>
</div>
