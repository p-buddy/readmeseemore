export const notImplemented = <K extends string>(key: K) => {
  const fn = (): any => { throw new Error(`Not implemented: ${key}`) }
  return { [key]: fn } as Record<K, () => any>
}