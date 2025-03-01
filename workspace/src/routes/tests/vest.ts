import { deferred } from "$lib/utils/index.js";
import { Ivya } from 'ivya';
import * as v from "@storybook/test";


type TestElements = Record<string, any>;

type SetElements<T extends TestElements> = (value: Partial<T>) => void;

type WithSetElements<T extends TestElements> = { set: SetElements<T> };

type TestHarness<T extends TestElements> = WithSetElements<T> & {
  given: <K extends keyof T>(...keys: K[]) => Promise<Pick<T, K>>;
  v: typeof v;
};

type TestCallback<T extends TestElements> = (harness: TestHarness<T>) => Promise<void>;

type TestBase<T extends TestElements> = WithSetElements<T>;

type Vest<T extends TestElements> = Partial<T> & TestBase<T>

let _current: any | null = null;

export const run = async <T extends TestElements>(body: TestCallback<T>): Promise<void> => {
  if (_current !== null) throw new Error("Cannot run test while another is running");

  type Deffered = ReturnType<typeof deferred>;
  const deferredMap = new Map<string | symbol, Deffered>();

  const retrieveDeffered = (key: string | symbol) => {
    if (deferredMap.has(key)) {
      const existing = deferredMap.get(key)!;
      deferredMap.delete(key);
      return existing;
    }
    const _deferred = deferred();
    deferredMap.set(key, _deferred);
    return _deferred;
  };

  let self: Vest<T>;

  const set: SetElements<T> = (obj: Partial<T>) =>
    Object.entries(obj).forEach(([key, value]) => {
      self[key as keyof T] = value;
    });

  const harness: TestHarness<T> = {
    v,
    set,
    given: async (...keys) => {
      const resolved = await Promise.all(
        keys.map((k) => retrieveDeffered(k as string).promise),
      );
      return (resolved as any[]).reduce(
        (acc, curr, index) => {
          (acc as any)[keys[index]] = curr;
          return acc;
        },
        {} as Pick<T, (typeof keys)[number]>,
      );
    },
  };

  const base: TestBase<T> = { set };

  self = new Proxy(({}) as Vest<T>, {
    set: (target, prop, value) => {
      switch (prop as keyof TestBase<T>) {
        case "set" satisfies keyof TestBase<T>:
          throw new Error("Cannot set reserved properties of test base");
        default:
          target[prop as keyof T] = value;
          retrieveDeffered(prop).resolve(value);
          return true;
      }
    },
    get: (target, prop) => {
      switch (prop) {
        case "set" satisfies keyof TestBase<T>:
          return base[prop];
        default:
          return target[prop as keyof T];
      }
    },
  });

  _current = self;
  await body(harness);
  _current = null;
  deferredMap.clear();
};

export const current = <T extends Record<string, any>>(): Vest<T> => {
  if (_current === null) {
    return new Proxy({} as Vest<T>, {
      get: () => { },
      set: (target, key, value) => {
        if (value !== null) throw new Error(`Cannot update property ${String(key)} on non-existent test`);
        return true;
      }
    });
  }
  return _current;
}