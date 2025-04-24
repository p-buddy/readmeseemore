const prefix = {
  ready: "RMSM_LS_READY",
  starting: "RMSM_LS_STARTING",
  msg: "(LS)",
} as const;

const startsWith = <T extends string>(prefix: T, msg: string) =>
  msg.startsWith(prefix);

const announcer = <TPrefix extends string, TArgs extends any[] = []>(prefix: TPrefix, fn?: (...args: TArgs) => void) =>
  Object.assign(fn ?? (() => console.log(prefix)), {
    is: startsWith.bind(null, prefix)
  } as const);

export const ready = announcer(prefix.ready);

export const starting = announcer(prefix.starting);

export const announce = announcer(
  prefix.msg,
  (identifier: string, msg: string, payload: any) => {
    const opener = `${prefix.msg} ${identifier}: `;
    console.log(opener, msg);
    console.log(opener + JSON.stringify(payload, null, 2));
  });