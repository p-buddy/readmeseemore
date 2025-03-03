<script lang="ts" module>
  // should retrieve dynamically in the case of playwright
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

  type TestElements = Record<string, any>;

  type TestHarness<T extends TestElements> = {
    given: (...keys: (keyof T)[]) => Promise<Pick<T, (typeof keys)[number]>>;
    set: (value: Partial<T>) => void;
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

  let initialMount = false;
  let container: HTMLDivElement | undefined;
  const reparent = (element: HTMLElement) => {
    container!.appendChild(element);
  };

  type Task = Record<"start" | "complete", Promise<any>> & {
    mode: "serial" | "parallel";
  };

  let tail: Task | undefined;

  const enqueue = (mode: Task["mode"], fn: () => Promise<any>) => {
    let task: Task;

    if (!tail) {
      const start = Promise.resolve();
      task = { mode, start, complete: start.then(fn) };
    } else if (mode === "serial") {
      const start = tail.complete;
      task = { mode, start, complete: start.then(fn) };
    } else if (tail.mode === "serial") {
      const start = tail.complete;
      task = { mode, start, complete: start.then(fn) };
    } else {
      const { start, complete } = tail;
      task = { mode, start, complete: Promise.all([complete, start.then(fn)]) };
    }

    task.complete.finally(() => {
      if (tail === task) tail = undefined;
    });

    tail = task;
    return task.start;
  };
</script>

<script lang="ts" generics="T extends TestElements">
  import { onMount, type Snippet } from "svelte";
  type Props = {
    vest: Snippet<[pocket: T]>;
    body: TestCallback<T>;
    name?: string;
    id?: string;
    mode?: Task["mode"];
  };

  let { body, vest, mode = "serial" }: Props = $props();

  const deferredMap = new Map<
    string | symbol,
    ReturnType<typeof deferred<T>>
  >();

  const pocket: T = new Proxy({} as T, {
    set: (target, prop, value) => {
      target[prop as keyof T] = value;
      retrieve(deferredMap, prop).resolve(value);
      return true;
    },
    get: (target, prop) => target[prop as keyof T],
  });

  const set: TestHarness<T>["set"] = (obj: Partial<T>) =>
    Object.entries(obj).forEach(([key, value]) => {
      pocket[key as keyof T] = value;
    });

  const given: TestHarness<T>["given"] = async (...keys) => {
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
  let start = $state.raw<Promise<any>>();

  onMount(async () => {
    if (!root) throw new Error("Root element not found");
    reparent(root);
    const harness: TestHarness<T> = {
      ...tester,
      root,
      set,
      given,
    };
    start = enqueue(mode, async () => {
      await body(harness);
      deferredMap.clear();
    });
  });
</script>

{#if !initialMount}
  <div class="h-screen w-screen flex" bind:this={container}></div>
  {void (initialMount = true)}
{/if}

<div class="flex-grow" bind:this={root}>
  {#if root && start}
    {#await start then}
      {@render vest(pocket)}
    {/await}
  {/if}
</div>
