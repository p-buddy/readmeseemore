// place files you want to import through the `$lib` alias in this folder.

export const fetchMarkdown = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  return text;
};

export const untilFontsLoaded = async (...families: string[]) => {
  let ready = await document.fonts.ready;
  return new Promise<boolean>((resolve) => {
    ready.onloadingdone = (event) => {
      const loaded = event.fontfaces.map((f) => f.family);
      for (const family of families)
        if (!loaded.includes(family))
          return resolve(false);
      resolve(true);
    };
  });
};
