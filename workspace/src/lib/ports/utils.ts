export const unique = <T extends string>(
  url: T
) => (
  url.includes("?")
    ? `${url}&_=${Date.now()}` as `${T}&_=${number}`
    : `${url}?_=${Date.now()}` as `${T}?_=${number}`
) as T extends `${string}?${string}` ? `${T}&_=${number}` : `${T}?_=${number}`;

export const getPort = (url: string) => {
  const port = url.split(/[:/?]/).find((part) => /^\d+$/.test(part));
  if (!port) throw new Error("Unable to extract port from url: " + url);
  return Number(port);
};
