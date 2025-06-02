import { tryConnectElements, anchors } from "$lib/utils/elbow-connector/index.js";
import type { Keyed } from "./common.svelte.js";
import { rectify } from "./connections.js";
import { computeLayoutInPlace } from "./layout.js";
import type { BoundingBox } from "./math.js";

export type Input = {
  width: number;
  height: number;
  comments: Keyed<BoundingBox>[];
  indicators: Keyed<BoundingBox>[];
}

type Path = ReturnType<typeof tryConnectElements>;

export type Output = {
  comments: Keyed<BoundingBox>[];
  paths: Path[];
}

const commentEntry = (comment: Keyed<BoundingBox>) => {
  rectify(comment);
  return [comment.key, comment] as const;
}

onmessage = (event) => {
  const { width, height, comments, indicators } = event.data as Input;
  computeLayoutInPlace(width, height, comments);
  const commentByKey = new Map(comments.map(commentEntry));

  const paths = new Array<Path>(indicators.length);

  for (let i = 0; i < indicators.length; i++) {
    const indicator = indicators[i];
    const comment = commentByKey.get(indicator.key)!;
    rectify(indicator);
    const points = tryConnectElements(
      indicator,
      comment,
      anchors.midTop,
      anchors.midBottom,
      true,
    );
    paths[i] = points;
  }

  postMessage({
    comments,
    paths,
  } satisfies Output);
};