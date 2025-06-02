<script lang="ts" module>
  type Props = {
    path: Point[];
    parent: HTMLElement;
    width?: number;
    smoothing?: number;
    class?: string;
    style?: string;
  };

  const toHalfPixel = {
    round: (value: number) => Math.round(value * 2) / 2,
    ceil: (value: number) => Math.ceil(value * 2) / 2,
    floor: (value: number) => Math.floor(value * 2) / 2,
  };
</script>

<script lang="ts">
  import { createSvgPath } from "./third-party/svg.js";
  import type { Point } from "./third-party/types.js";

  let { path, parent, smoothing = 0, width = 3, ...rest }: Props = $props();

  const origin = $derived(parent.getBoundingClientRect());

  export const update = (_path: Point[]) => (path = _path);

  const bounding = $derived.by(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of path) {
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
  });

  const localCoordinates = $derived(
    path.map(({ x, y }) => ({
      x: toHalfPixel.round(x - bounding.x),
      y: toHalfPixel.round(y - bounding.y),
    })),
  );
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
      d={createSvgPath(localCoordinates, smoothing)}
      stroke-linecap="butt"
      stroke-width={width}
      stroke="currentColor"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</div>
