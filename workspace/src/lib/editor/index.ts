let initializing: Promise<void> | undefined;
let initialized = false;

const onInitCallbacks = new Set<() => void>();

export const onInit = (callback: () => void) => {
  if (initialized) return callback();
  onInitCallbacks.add(callback);
}

export const initializeOnce = (initializer: () => typeof initializing) => {
  if (initializing) return initializing;
  initializing = initializer();
  initializing!.then(() => {
    for (const callback of onInitCallbacks) callback();
    onInitCallbacks.clear();
    initialized = true;
  });
  return initializing;
};

export const languageByExtension = {
  ts: "typescript",
  js: "javascript",
  svelte: "svelte",
} as const;

export type Extension = keyof typeof languageByExtension;
export type SupportedLanguage = typeof languageByExtension[Extension];

export const tryGetLanguageByFileExtension = (extension?: string) => {
  if (!extension || !(extension in languageByExtension)) return;
  return languageByExtension[extension as Extension];
};

export const tryGetLanguageByFile = (path?: string) => {
  const extension = path?.split(".").pop();
  return tryGetLanguageByFileExtension(extension);
};