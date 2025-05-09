export const parse = {
  rgba: (rgb_a: string) => {
    const matches = rgb_a.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (!matches) return;
    const [, r, g, b, a] = matches.map(x => x === null ? 1 : Number(x));
    return { r, g, b, a };
  }
} as const;

export type RGBA = Exclude<ReturnType<typeof parse.rgba>, undefined>;

export const blend = (left: RGBA, right: RGBA) => {
  const a = left.a + right.a * (1 - left.a);
  return {
    r: Math.round((left.r * left.a + right.r * right.a * (1 - left.a)) / a),
    g: Math.round((left.g * left.a + right.g * right.a * (1 - left.a)) / a),
    b: Math.round((left.b * left.a + right.b * right.a * (1 - left.a)) / a),
    a,
  };
}

export const stringify = {
  rgba: ({ r, g, b, a }: RGBA) => `rgba(${r}, ${g}, ${b}, ${a})`,
} as const;

export const findNearestBackgroundColor = (element: HTMLElement): string => {
  while (element && element !== document.body) {
    const { backgroundColor } = getComputedStyle(element);
    if (backgroundColor && backgroundColor.toLowerCase() !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)")
      return backgroundColor;
    element = element.parentElement!;
  }
  return getComputedStyle(document.body).background || 'back';
}

export const colors = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  white: { r: 255, g: 255, b: 255, a: 1 },
} satisfies Record<string, RGBA>;

export const boost = (color: RGBA, amount: number = 10) => {
  const { r, g, b, a } = color;
  return {
    r: Math.min(r + amount, 255),
    g: Math.min(g + amount, 255),
    b: Math.min(b + amount, 255),
    a,
  };
}
