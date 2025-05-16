import type { WebContainerProcess } from "@webcontainer/api";
import type { WebContainer } from "@webcontainer/api";
import { type Status, cli } from "./common.js";
import type { ITheme, Terminal, IDisposable } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { defer, removeFirstInstance, removeLastInstance, type Deferred } from "$lib/utils/index.js";
import stripAnsi from "strip-ansi";
import { mount, unmount } from "svelte";
import Suggestion, { type Props as SuggestionProps } from "./Suggestion.svelte";
export type { IDisposable };

const sanitize = (data: string, command: string) => {
  data = stripAnsi(data);
  data = removeFirstInstance(data, cli.input.prompt.prefix);
  data = removeFirstInstance(data, command);
  data = removeLastInstance(data, cli.output.location);
  return data.trim();
}

const isElement = (element?: Element): element is HTMLElement =>
  Boolean(element && element instanceof HTMLElement);

const isViewport = (element?: Element): element is HTMLElement =>
  isElement(element) && element.classList.contains("xterm-viewport");

const isScreen = (element?: Element): element is HTMLElement =>
  isElement(element) && element.classList.contains("xterm-screen");

const overlappingScrollbarHack = (viewport?: HTMLElement) => {
  if (!viewport) return;
  viewport.style.width = "calc(100% + 20px)";
}

type CaptureCommandOutput = (command: string, last?: boolean) => void;

class CommandQueue {
  private readonly commands: string[] = [];
  private readonly callbacks: (CaptureCommandOutput | undefined)[] = [];

  private defferedOnEmpty?: Deferred;

  public get onEmpty() {
    if (this.defferedOnEmpty)
      return this.defferedOnEmpty.promise;
    this.defferedOnEmpty = defer<void>();
    const { promise } = this.defferedOnEmpty;
    promise.then(() => this.defferedOnEmpty = undefined);
    return promise;
  }

  public get isEmpty() {
    return this.commands.length === 0;
  }

  public enqueue(command: string, callback?: CaptureCommandOutput) {
    this.commands.push(command);
    this.callbacks.push(callback);
  }

  public dequeue() {
    if (this.isEmpty) this.defferedOnEmpty?.resolve();
    else return [this.commands.shift(), this.callbacks.shift()] as const;
  }
}

type LimitedCommandQueue = Pick<CommandQueue, "isEmpty" | "onEmpty">;

let count = 0;

export default class {
  public readonly id: string;

  private executing: boolean = false;
  private receiving: boolean = false;
  private forceClear: boolean = false;
  private delayScrollDown: boolean = false;
  private _inputReady?: Deferred;
  private readonly queue = new CommandQueue();
  private onCapture?: CaptureCommandOutput;
  private element?: HTMLElement;
  private viewport?: HTMLElement;
  private screen?: HTMLElement;

  public fade(direction: "in" | "out", duration: number) {
    this.element!.style.opacity = direction === "in" ? "1" : "0";
    this.element!.style.transition = `opacity ${duration}ms ease-in-out`;
  }

  public get commandQueue(): LimitedCommandQueue {
    return this.queue;
  }

  public get inputReady() {
    if (this.receiving) return Promise.resolve();
    this._inputReady ??= defer<void>();
    return this._inputReady.promise;
  }

  public get userInput() {
    if (this.executing) return undefined;
    const { buffer: { active } } = this.xterm;
    const { cursorY, baseY } = active;
    const line = active.getLine(cursorY + baseY);
    if (!line) return undefined;
    let content = line.translateToString();
    if (content.startsWith(cli.input.prompt.prefix))
      content = content.slice(cli.input.prompt.prefix.length).trim();
    return content.length > 0 ? content : undefined;
  }

  public get isExecuting() {
    return this.executing;
  }

  private constructor(
    public readonly container: WebContainer,
    public readonly jsh: WebContainerProcess,
    private readonly input: WritableStreamDefaultWriter<string>,
    public readonly xterm: Terminal,
    private readonly fitAddon: FitAddon,
    terminalTheme?: ITheme,
  ) {
    xterm.options.theme = terminalTheme ?? {
      background: "#181818",
    };
    xterm.onData(this.onInput.bind(this));
    jsh.output.pipeTo(new WritableStream({ write: this.onOutput.bind(this) }));
    xterm.clear();
    this.id = `${count++}`;
  }

  public static async New(container: WebContainer, status?: Status) {
    status?.("Importing xterm");
    const [{ Terminal }, { FitAddon }] = await Promise.all([
      import("@xterm/xterm"),
      import("@xterm/addon-fit"),
    ]);

    const xterm = new Terminal({
      convertEol: true, allowProposedApi: true,
    });
    const addon = new FitAddon();
    const { cols, rows } = xterm;
    xterm.loadAddon(addon);

    status?.("Spawning jsh");
    const jsh = await container.spawn("jsh", {
      env: {},
      terminal: { cols, rows },
    });

    status?.("Reading jsh output");
    const reader = jsh.output.getReader();
    const input = jsh.input.getWriter();
    await reader.read();
    reader.releaseLock();

    return new this(container, jsh, input, xterm, addon);
  }

  public mount(parent: HTMLElement, fade?: number) {
    this.element = parent;
    if (fade) {
      this.element!.style.opacity = "0";
      requestAnimationFrame(() => this.fade("in", fade));
    }
    this.xterm.open(parent);
    this.fit();

    const container = this.element?.children[0];
    const viewport = container?.children[0];
    const screen = container?.children[1];
    if (isViewport(viewport)) this.viewport = viewport;
    else console.error("Terminal viewport not found");
    if (isScreen(screen)) this.screen = screen;
    else console.error("Terminal screen not found");

    overlappingScrollbarHack(this.viewport);
  }

  public suggest(content: string, fadeIn = true) {
    const decoration = this.xterm.registerDecoration({
      marker: this.xterm.registerMarker(0),
      x: 1,
      layer: "top",
    });
    if (!decoration) return;
    let hault = false;
    const dispose = () => (hault = true, decoration.dispose());
    const disposable: IDisposable = { dispose };

    decoration.onRender((target) => {
      if (hault) return;
      hault = true;
      const inMs = fadeIn ? 300 : 50;
      const props: SuggestionProps = { content, inMs, outMs: 400 };
      const suggestion = mount(Suggestion, { target, props });
      requestAnimationFrame(() => suggestion.visible(true));
      const remove = () => (unmount(suggestion), decoration.dispose());
      disposable.dispose = () => suggestion.visible(false, true).then(remove);
    });

    return disposable;
  }

  public async dispose() {
    this.fitAddon.dispose();
    this.xterm.dispose();
    this.jsh.kill();
    await this.jsh.exit;
  }

  public fit() {
    this.fitAddon.fit();
    const { cols, rows } = this.xterm;
    this.jsh.resize({ cols, rows });
  }

  public scrollToBottom() {
    this.viewport?.scrollTo({ top: this.viewport.scrollHeight, behavior: "smooth" });
  }

  public enqueueCommand(command: string): void;
  public enqueueCommand(command: string, capture: true): Promise<string>;
  public enqueueCommand(command: string, capture?: boolean): Promise<string> | void {
    if (!command.endsWith(cli.input.user.return))
      command += cli.input.user.return;

    const { queue: commandQueue } = this;

    let onCapture: CaptureCommandOutput | undefined;
    let deferredCapture: ReturnType<typeof defer<string>> | undefined;

    if (capture) {
      let captured = "";
      deferredCapture = defer<string>();
      onCapture = (data, last) => {
        captured += data;
        if (!last) return;
        deferredCapture?.resolve(sanitize(captured, command));
        this.onCapture = undefined;
      };
    }

    if (this.executing || !this.receiving)
      (commandQueue as CommandQueue).enqueue(command, onCapture);
    else {
      const current = this.getAndClearUserInput();
      if (current) commandQueue.onEmpty.then(() => this.input.write(current));
      this.executing = true;
      this.input.write(command);
      this.onCapture = (data, last) => {
        if (!last) this.delayScrollDown = true;
        onCapture?.(data, last);
      };
    }
    return deferredCapture?.promise;
  }

  private onInput(data: string) {
    if (data === cli.input.user.return) this.executing = true;
    this.input.write(data);
  }

  private onOutput(data: string) {
    if (!this.receiving) this._inputReady?.resolve();
    this.receiving = true;
    let callback: (() => void) | undefined;
    switch (data) {
      case cli.input.prompt.default:
      case cli.input.prompt.error:
        if (this.forceClear) {
          this.forceClear = false;
          break;
        }
        this.onCapture?.("", true);
        this.executing = false;
        const next = (this.queue as CommandQueue).dequeue();
        if (next)
          callback = () => {
            this.input.write(next[0]);
            this.onCapture = next[1];
          };
        break;
    }
    if (!this.forceClear) this.onCapture?.(data);

    if (this.delayScrollDown) callback = this.delayedScrollCallback(callback);
    this.delayScrollDown = false;

    this.xterm.write(data, callback);
  }

  private getAndClearUserInput() {
    const current = this.userInput;
    if (!current) return undefined;
    this.input.write(cli.input.eol);
    this.forceClear = true;
    for (let i = 0; i < current.length; i++)
      this.input.write(cli.input.backspace);
    return current;
  }

  private delayedScrollCallback(toWrap?: () => void, delay = 200) {
    const { viewportY } = this.xterm.buffer.active;
    return () => {
      toWrap?.();
      this.xterm.scrollToLine(viewportY);
      setTimeout(this.scrollToBottom.bind(this), delay)
    }
  }
}