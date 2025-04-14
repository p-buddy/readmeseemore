let initialized: Promise<void> | undefined;

export const initialize = (initializer: () => typeof initialized) => {
  if (initialized) return initialized;
  initialized = initializer();
  return initialized;
};
