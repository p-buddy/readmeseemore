import LayoutWorker from "./layout-worker?worker";
import type { Input, Output, OutputIndex, OutputElement, } from "./layout-worker.js";
import { defer, type Deferred, type Last, type Maybe } from "$lib/utils/index.js";

let layoutThreads = 0;

const layoutThread = () => {
  const worker = new LayoutWorker();
  return new Promise<Worker>((resolve) => {
    const onReady = () => {
      layoutThreads++;
      console.log(`Layout worker ready (thread ${layoutThreads})`);
      resolve(worker);
      worker.removeEventListener("message", onReady);
    }
    worker.addEventListener("message", onReady);
  });
}

export class ThreadedLayout {
  private static readonly ThreadPoolSize = 2;
  private pool: Worker[] = [];

  constructor() {
    layoutThread().then((worker) => this.pool.push(worker));
  }

  async compute(input: Input) {
    type Return = <Index extends OutputIndex>(index: Index) => Promise<Output[Index]>;

    if (layoutThreads === 0) {
      const result = new Array<OutputElement>();
      const { computeLayout } = await import("./layout-worker.js")
      computeLayout(input, (_, data) => result.push(data));
      return ((index: number) => Promise.resolve(result[index])) as Return;
    }

    const worker = this.pool.pop() ?? await layoutThread();
    const store = new Array<OutputElement>();
    let current: Maybe<Deferred<OutputElement>>;
    worker.postMessage(input);

    const onMessage = ({ data }: MessageEvent<OutputElement>) => {
      if (data === (true satisfies Last<Output>)) {
        worker.removeEventListener("message", onMessage);
        if (this.pool.length < ThreadedLayout.ThreadPoolSize)
          this.pool.push(worker);
        else {
          console.warn("Layout worker pool full, terminating worker. If this happens often, something could be going wrong.");
          worker.terminate();
        }
      } else {
        current?.resolve(data);
        current = undefined;
        store.push(data);
      }
    }
    worker.addEventListener("message", onMessage);
    return (
      (index: number) => {
        if (index < store.length) return Promise.resolve(store[index]);
        current = defer();
        return current.promise;
      }
    ) as Return;
  }
}