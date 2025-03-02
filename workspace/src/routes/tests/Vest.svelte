<script lang="ts" module>
  import * as tester from "@storybook/test";

  const deferred = <T,>() => {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: any) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve: resolve!, reject: reject! };
  };

  type Deffered<T = any> = ReturnType<typeof deferred<T>>;

  type TestElements = Record<string, any>;

  type SetElements<T extends TestElements> = (value: Partial<T>) => void;

  type WithSetElements<T extends TestElements> = { set: SetElements<T> };

  type Given<T extends TestElements> = (
    ...keys: (keyof T)[]
  ) => Promise<Pick<T, (typeof keys)[number]>>;

  type TestHarness<T extends TestElements> = WithSetElements<T> & {
    given: Given<T>;
    root: HTMLElement;
  } & typeof tester;

  type TestCallback<T extends TestElements> = (
    harness: TestHarness<T>,
  ) => Promise<void>;

  const retrieve = <Key,>(map: Map<Key, any>, key: Key) => {
    if (map.has(key)) {
      const existing = map.get(key)!;
      map.delete(key);
      return existing;
    }
    const _deferred = deferred();
    map.set(key, _deferred);
    return _deferred;
  };

  let container: HTMLDivElement | undefined;
</script>

<script lang="ts" generics="T extends TestElements">
  import { onMount, type Snippet } from "svelte";
  type Props = {
    vest: Snippet<[pocket: T]>;
    body: TestCallback<T>;
  };

  let { body, vest }: Props = $props();

  const deferredMap = new Map<string | symbol, Deffered>();

  const pocket: T = new Proxy({} as T, {
    set: (target, prop, value) => {
      target[prop as keyof T] = value;
      retrieve(deferredMap, prop).resolve(value);
      return true;
    },
    get: (target, prop) => target[prop as keyof T],
  });

  const set: SetElements<T> = (obj: Partial<T>) =>
    Object.entries(obj).forEach(([key, value]) => {
      pocket[key as keyof T] = value;
    });

  const given: Given<T> = async (...keys) => {
    const resolved = await Promise.all(
      keys.map((k) => retrieve(deferredMap, k as string).promise),
    );
    return (resolved as any[]).reduce(
      (acc, curr, index) => {
        (acc as any)[keys[index]] = curr;
        return acc;
      },
      {} as Pick<T, (typeof keys)[number]>,
    );
  };

  let root = $state.raw<HTMLDivElement>();

  onMount(async () => {
    container!.appendChild(root!);
    await body({
      ...tester,
      root: root!,
      set,
      given,
    });
    deferredMap.clear();
  });
</script>

{#if !container}
  <div class="h-screen w-screen flex" bind:this={container}></div>
{/if}

<div class="flex-grow" bind:this={root}>
  {#if root}{@render vest(pocket)}{/if}
</div>
