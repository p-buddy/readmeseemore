import type { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { file } from "../utils/fs-helper.js";
import type { ITheme } from "@xterm/xterm";
import { boot, root, teardown } from "./common.js";
import Terminal from "./terminal.js";
import { cli } from "./common.js";

type FsChange = {
  action: "add" | "unlink" | "addDir" | "unlinkDir" | "change",
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

export default class OperatingSystem {
  public terminalIndex = 0;
  public readonly terminals: Terminal[] = [];

  public get terminal() {
    return this.terminals[this.terminalIndex];
  }

  private constructor(
    public readonly container: WebContainer,
    terminal: Terminal,
    private _watch?: Promise<WebContainerProcess>,
    private onChange?: Set<FsChangeCallback>,
  ) {
    this.terminals.push(terminal);
  }

  private static instance: OperatingSystem | null = null;

  public async watch(callback: FsChangeCallback) {
    this.onChange ??= new Set<FsChangeCallback>();
    this.onChange.add(callback);
    this._watch ??= OperatingSystem.Watch(this.container, this.onChange);
    await this._watch;
  }

  public async addTerminal(updateIndex: boolean = false) {
    const terminal = await Terminal.New(this.container);
    const length = this.terminals.push(terminal);
    if (updateIndex) this.terminalIndex = length - 1;
    return terminal;
  }

  public static async Create(options?: CreateOptions) {
    if (options?.force) {
      options.status?.("Disposing of existing web container instance");
      await OperatingSystem.Dispose();
    }
    OperatingSystem.instance ??= await OperatingSystem.Factory(options);
    return OperatingSystem.instance;
  }

  static async Dispose() {
    const { instance } = OperatingSystem;
    if (instance) {
      await Promise.all(instance.terminals.map(t => t.dispose()));
      await instance._watch?.then($ => ($.kill(), $.exit));
    }
    teardown();
    OperatingSystem.instance = null;
  }

  private static async Watch(container: WebContainer, onChange: Set<FsChangeCallback>) {
    const watchConfig = {
      command: "chokidar-cli",
      directory: ".",
      ignore: '"(**/(_tmp_)**)"'
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
          let path = data.split(':').at(1)?.trim() || '';

          if (path.startsWith(root)) path = path.slice(root.length);

          switch (action) {
            case 'add':
            case 'unlink':
            case 'change':
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

    const terminal = await Terminal.New(container, status)

    let onChange: Set<FsChangeCallback> | undefined;
    let watch: Promise<WebContainerProcess> | undefined;

    if (options?.watch) {
      onChange = new Set<FsChangeCallback>();
      watch = OperatingSystem.Watch(container, onChange);
    }

    return new OperatingSystem(container, terminal, watch, onChange);
  }
}