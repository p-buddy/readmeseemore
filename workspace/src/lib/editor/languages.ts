
export const languageByExtension = {
  ts: "typescript",
  js: "javascript",
  svelte: "svelte",
  html: "html",
  css: "css",
  md: "markdown",
  json: "json",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  jsx: "react",
  tsx: "react",
} as const;

export type Extension = keyof typeof languageByExtension;
export type SupportedLanguage = typeof languageByExtension[Extension];

export const tryGetLanguageByFileExtension = (extension?: string) => {
  if (!extension || !(extension in languageByExtension)) return;
  return languageByExtension[extension as Extension];
};

export const tryGetLanguageByFile = (path?: string) => {
  if (!path) return;
  const index = path.lastIndexOf(".");
  if (index < 0) return;
  const extension = path.slice(index + 1);
  return tryGetLanguageByFileExtension(extension);
};