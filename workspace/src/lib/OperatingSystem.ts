import type { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper.js";
import type { ITheme, Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import { boot, teardown } from "./utils/webcontainer.js";
import { defer } from "./utils/index.js";

const cli = {
  flags: {
    npx: {
      yesToAll: "-y",
    },
    chokidar: {
      ignore: "-i",
    }
  },
  input: {
    prompt: {
      default: "\u001b[1G\u001b[0J\u001b[35m❯\u001b[39m \u001b[3G",
      error: "\u001b[1G\u001b[0J\u001b[31m❯\u001b[39m \u001b[3G",
      prefix: "❯ "
    },
    user: {
      return: "\r",
    },
    eol: String.fromCharCode(5),
    backspace: "\b"
  }
} as const;

type FsChange = {
  action: "add" | "unlink" | "addDir" | "unlinkDir",
  type: "file" | "folder",
  path: string,
}

type FsChangeCallback = (change: FsChange) => any;

export type CreateOptions = {
  terminalTheme?: ITheme,
  filesystem?: FileSystemTree,
  status?: (status: string) => void,
  force?: boolean,
  watch?: boolean,
}

class CommandQueue {
  private readonly queue: string[] = [];
  private defferedOnEmpty?: ReturnType<typeof defer<void>>;

  public get onEmpty() {
    if (this.defferedOnEmpty)
      return this.defferedOnEmpty.promise;
    this.defferedOnEmpty = defer<void>();
    const { promise } = this.defferedOnEmpty;
    promise.then(() => this.defferedOnEmpty = undefined);
    return promise;
  }

  public get isEmpty() {
    return this.queue.length === 0;
  }

  public enqueue(command: string) {
    this.queue.push(command);
  }

  public dequeue() {
    if (this.isEmpty) return this.defferedOnEmpty?.resolve();
    else return this.queue.shift();
  }
}

export default class OperatingSystem {
  private executing: boolean = false;
  private forceClear: boolean = false;

  public readonly commandQueue: CommandQueue = new CommandQueue();

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

  private constructor(
    public readonly container: WebContainer,
    public readonly jsh: WebContainerProcess,
    private readonly input: WritableStreamDefaultWriter<string>,
    public readonly xterm: Terminal,
    private readonly fitAddon: FitAddon,
    private _watch?: Promise<WebContainerProcess>,
    private onChange?: Set<FsChangeCallback>
  ) {
    xterm.onData((data) => input.write(data));
    const self = this;
    xterm.onKey(({ key }) => {
      if (key === "Enter") self.executing = true;
    })
    jsh.output.pipeTo(new WritableStream({
      write: this.onJshOutput.bind(this),
    }));
    xterm.clear();
  }

  private static instance: OperatingSystem | null = null;

  private onJshOutput(data: string) {
    let callback: (() => void) | undefined;
    switch (data) {
      case cli.input.prompt.default:
      case cli.input.prompt.error:
        if (this.forceClear) {
          this.forceClear = false;
          break;
        }
        this.executing = false;
        const command = this.commandQueue.dequeue();
        if (command) callback = () => this.input.write(command);
        break;
    }
    this.xterm.write(data, callback);
  }

  public getAndClearUserInput() {
    const current = this.userInput;
    if (!current) return undefined;
    this.input.write(cli.input.eol);
    this.forceClear = true;
    for (let i = 0; i < current.length; i++)
      this.input.write(cli.input.backspace);
    return current;
  }


  public enqueue(command: string, onEmpty?: () => void) {
    if (!command.endsWith(cli.input.user.return))
      command += cli.input.user.return;

    const { commandQueue } = this;

    if (onEmpty) commandQueue.onEmpty.then(onEmpty);

    if (this.executing)
      commandQueue.enqueue(command);
    else {
      const current = this.getAndClearUserInput();
      if (current) commandQueue.onEmpty.then(() => this.input.write(current));
      this.executing = true;
      this.input.write(command);
    }
  }

  public async watch(callback: FsChangeCallback) {
    this.onChange ??= new Set<FsChangeCallback>();
    this.onChange.add(callback);
    this._watch ??= OperatingSystem.Watch(this.container, this.onChange);
    await this._watch;
  }

  public fitXterm() {
    this.fitAddon.fit();
    this.jsh.resize({ cols: this.xterm.cols, rows: this.xterm.rows });
  }

  static async Create(options?: CreateOptions) {
    if (options?.force) {
      options.status?.("Disposing of existing web container instance");
      await OperatingSystem.Dispose();
    }
    OperatingSystem.instance ??= await OperatingSystem.Factory(options);
    OperatingSystem.instance.xterm.options.theme = options?.terminalTheme;
    return OperatingSystem.instance;
  }

  static async Dispose() {
    const { instance } = OperatingSystem;
    if (instance) {
      instance.fitAddon.dispose();
      instance.xterm.dispose();
      instance.jsh.kill();
      await instance.jsh.exit;
      await instance._watch?.then($ => ($.kill(), $.exit));
    }
    teardown();
    OperatingSystem.instance = null;
  }

  private static async Watch(container: WebContainer, onChange: Set<FsChangeCallback>) {
    const watchConfig = {
      command: "chokidar-cli",
      directory: ".",
      ignore: '"(**/(node_modules|.git|_tmp_)**)"'
    } as const;

    const watch = await container.spawn('npx', [
      cli.flags.npx.yesToAll,
      watchConfig.command,
      watchConfig.directory,
      cli.flags.chokidar.ignore,
      watchConfig.ignore,
    ]);

    return new Promise<WebContainerProcess>(async (resolve, reject) => {
      let ready = false;

      watch.output.pipeTo(new WritableStream({
        async write(data) {
          if (!ready) {
            ready = data.includes(`Watching "${watchConfig.directory}"`);
            if (!ready) return;
            resolve(watch);
          }

          const action: string = data.split(':').at(0) || '';
          const path = data.split(':').at(1)?.trim() || '';

          switch (action) {
            case 'add':
            case 'unlink':
              const file = { action, path, type: "file" } as const;
              onChange.forEach(cb => cb(file));
              break;
            case 'addDir':
            case 'unlinkDir':
              const folder = { action, path, type: "folder" } as const;
              onChange.forEach(cb => cb(folder));
              break;
          }
        }
      }));
    });
  }

  private static async Factory(options?: Omit<CreateOptions, "terminalTheme">) {
    const status = options?.status;

    status?.("Booting container");
    const container = await boot();

    status?.("Mounting filesystem");
    container.mount({
      ...file(".jshrc", [
        'export PNPM_HOME="/home/.pnpm"',
        'export PATH="/bin:/usr/bin:/usr/local/bin:/home/.pnpm"',
        'alias ni="npx -y --package=@antfu/ni -- ni"',
      ]),
      ...(options?.filesystem ?? {}),
    });

    status?.("Moving jshrc");
    const mv = await container.spawn("mv", [".jshrc", "/home/.jshrc"]);
    await mv.exit;
    mv.kill();

    status?.("Creating terminal");
    const xterm = new (await import("@xterm/xterm")).Terminal({ convertEol: true });
    const addon = new (await import("@xterm/addon-fit")).FitAddon();
    const { cols, rows } = xterm;
    xterm.loadAddon(addon);

    let onChange: Set<FsChangeCallback> | undefined;
    let watch: Promise<WebContainerProcess> | undefined;

    if (options?.watch) {
      onChange = new Set<FsChangeCallback>();
      watch = OperatingSystem.Watch(container, onChange);
    }

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

    return new OperatingSystem(container, jsh, input, xterm, addon, watch, onChange);
  }
}