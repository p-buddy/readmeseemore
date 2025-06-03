import LayoutWorker from "./worker?worker";
import {
  type Input,
  type Output,
  type OutputIndex,
  type OutputElement,
  computeLayout,
} from "./worker.js";
import { defer, type Deferred, type Last, type Maybe } from "$lib/utils/index.js";

export class ThreadedLayout {
  private worker = new LayoutWorker();
  private ready = false;
  private pending: Maybe<Promise<void>>;

  constructor() {
    this.worker.onmessage = () => {
      console.log("Layout worker ready, switching to threaded mode");
      this.ready = true;
      this.worker.onmessage = null;
    };
  }

  async compute(input: Input) {
    type Return = <Index extends OutputIndex>(index: Index) => Promise<Output[Index]>;

    if (!this.ready) {
      const result = new Array<OutputElement>();
      computeLayout(input, (_, data) => result.push(data));
      return ((index: number) => Promise.resolve(result[index])) as Return;
    }

    if (this.pending) await this.pending;
    const completed = defer<void>();
    this.pending = completed.promise;
    const store = new Array<OutputElement>();
    let current: Maybe<Deferred<OutputElement>>;
    this.worker.postMessage(input);
    this.worker.onmessage = ({ data }) => {
      if (data === (true satisfies Last<Output>)) {
        completed.resolve();
        this.pending = undefined;
        this.worker.onmessage = null;
      } else {
        current?.resolve(data);
        current = undefined;
        store.push(data);
      }
    };
    return (
      (index: number) => {
        if (index < store.length) return Promise.resolve(store[index]);
        current = defer();
        return current.promise;
      }
    ) as Return;
  }
}