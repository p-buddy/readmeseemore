export const unique = (url: string) =>
  url.includes("?")
    ? `${url}&_=${Date.now()}`
    : `${url}?_=${Date.now()}`;

export const getPort = (url: string) =>
  url.split(/[:/?]/).find((part) => /^\d+$/.test(part));