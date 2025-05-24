export type Index = number;
export type Range = [Index, Index];
export type Ranges = Index | Range | Range[];

export const isIndex = (ranges: Ranges): ranges is Index =>
  !Array.isArray(ranges);

export const isSingleRange = (ranges: Ranges): ranges is Range =>
  !isIndex(ranges) && !Array.isArray(ranges[0]);

export type BoundingBox = Pick<DOMRect, "left" | "top" | "width" | "height">;

export const float = (query: string | number) =>
  typeof query === "string" ? parseFloat(query) : query;

type StyleBoundingBox = Pick<HTMLDivElement["style"], keyof BoundingBox>;

type MaybeBox = BoundingBox | StyleBoundingBox;

const distance = (a: MaybeBox, b: MaybeBox) => {
  const dx = float(a.left) - float(b.left);
  const dy = float(a.top) - float(b.top);
  return Math.sqrt(dx * dx + dy * dy);
};

const overlap = (a: MaybeBox, b: MaybeBox): boolean =>
  float(a.left) < float(b.left) + float(b.width) &&
  float(a.left) + float(a.width) > float(b.left) &&
  float(a.top) < float(b.top) + float(b.height) &&
  float(a.top) + float(a.height) > float(b.top);

const sortBoxes = (a: BoundingBox, b: BoundingBox) =>
  a.top === b.top ? a.left - b.left : a.top - b.top;

const sortOnStyle = ({ style: a }: HTMLElement, { style: b }: HTMLElement) =>
  a.top === b.top ? float(a.left) - float(b.left) : float(a.top) - float(b.top);

export const sortAndAssign = (boxes: BoundingBox[], elements: HTMLElement[]) => {
  const payload = {
    assignments: new Map<number, HTMLElement>(),
    usedElementIndices: new Set<number>(),
  };

  boxes.sort(sortBoxes);
  elements.sort(sortOnStyle);

  let lastOverlap = -1;
  for (let i = 0; i < boxes.length; i++)
    for (let j = lastOverlap + 1; j < elements.length; j++) {
      if (payload.usedElementIndices.has(j)) continue;
      if (overlap(elements[j].style, boxes[i])) {
        payload.assignments.set(i, elements[j]);
        payload.usedElementIndices.add(j);
        lastOverlap = j;
        break;
      }
    }

  for (let i = 0; i < boxes.length; i++) {
    if (payload.assignments.has(i)) continue;
    const targetBox = boxes[i];
    const best = { index: -1, distance: Infinity };
    for (let j = 0; j < elements.length; j++) {
      if (payload.usedElementIndices.has(j)) continue;
      const dist = distance(elements[j].style, targetBox);
      if (dist >= best.distance) continue;
      best.index = j;
      best.distance = dist;
    }
    if (best.index === -1) continue;
    payload.usedElementIndices.add(best.index);
    payload.assignments.set(i, elements[best.index]);
  }

  return payload;
};

export const getLocalBoundingBoxOfRange = (
  range: Range, origin: DOMRect, elements: HTMLElement[]
) => {
  const start = elements[range[0]].getBoundingClientRect();
  const end = elements[range[1] - 1].getBoundingClientRect();
  if (end.top === start.top)
    return {
      left: start.left - origin.left,
      top: start.top - origin.top,
      width: end.left - start.left + end.width,
      height: start.height,
    } satisfies BoundingBox;

  const boundingBoxes = new Array<BoundingBox>();
  let left = start;
  let previous = start;
  for (let i = range[0] + 1; i < range[1] - 2; i++) {
    const current = elements[i].getBoundingClientRect();
    if (left.top !== current.top) {
      boundingBoxes.push({
        left: left.left - origin.left,
        top: left.top - origin.top,
        width: current.left - left.left + current.width,
        height: left.height,
      });
      left = current;
    }
    previous = current;
  }
  if (previous.top === end.top)
    boundingBoxes.push({
      left: left.left - origin.left,
      top: left.top - origin.top,
      width: end.left - left.left + end.width,
      height: left.height,
    });
  return boundingBoxes;
};

export const appendLocalBoundingBoxesOfRange = (
  boxes: BoundingBox[],
  range: Range,
  origin: DOMRect,
  elements: HTMLElement[]
) => {
  const bboxes = getLocalBoundingBoxOfRange(range, origin, elements);
  Array.isArray(bboxes) ? boxes.push(...bboxes) : boxes.push(bboxes);
  return bboxes;
};

export const resize = (
  style: StyleBoundingBox,
  rect: BoundingBox,
  overrides?: Partial<BoundingBox>,
) => {
  style.left = `${overrides?.left ?? rect.left}px`;
  style.top = `${overrides?.top ?? rect.top}px`;
  style.width = `${overrides?.width ?? rect.width}px`;
  style.height = `${overrides?.height ?? rect.height}px`;
};

export const xCenter = (rect: BoundingBox | BoundingBox[]) => {
  if (Array.isArray(rect)) {
    const left = rect.reduce((acc, r) => acc + r.left, 0) / rect.length;
    const width = rect.reduce((acc, r) => acc + r.width, 0) / rect.length;
    return left + width / 2;
  }
  return rect.left + rect.width / 2;
};
