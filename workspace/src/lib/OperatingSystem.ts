import type { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper.js";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { boot, teardown } from "./utils/webcontainer.js";

const cliFlags = {
  npx: {
    yesToAll: "-y",
  },
  chokidar: {
    ignore: "-i",
  }
} as const;

type FsChange = {
  action: "add" | "unlink" | "addDir" | "unlinkDir",
  type: "file" | "folder",
  path: string,
}

type FsChangeCallback = (change: FsChange) => any;

type CreateOptions = {
  terminalTheme?: ITheme,
  filesystem?: FileSystemTree,
  onStatus?: (status: string) => void,
}

export default class OperatingSystem {
  private onChange?: Set<FsChangeCallback>;
  #watch?: Promise<WebContainerProcess>;

  private constructor(
    public readonly container: WebContainer,
    public readonly jsh: WebContainerProcess,
    public readonly xterm: Terminal,
    private readonly fitAddon: FitAddon,
  ) { }

  private static instance: OperatingSystem | null = null;

  public async watch(callback: FsChangeCallback) {
    this.onChange ??= new Set<FsChangeCallback>();
    this.onChange.add(callback);
    this.#watch ??= OperatingSystem.Watch(this.container, this.onChange);
    await this.#watch;
  }

  public fitXterm() {
    this.fitAddon.fit();
  }

  static async Create(options?: CreateOptions) {
    OperatingSystem.instance ??= await OperatingSystem.Factory(options);
    OperatingSystem.instance.xterm.options.theme = options?.terminalTheme;
    return OperatingSystem.instance;
  }

  static dispose() {
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
      cliFlags.npx.yesToAll,
      watchConfig.command,
      watchConfig.directory,
      cliFlags.chokidar.ignore,
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
    const onStatus = options?.onStatus;

    onStatus?.("Booting container");
    const container = await boot();
    onStatus?.("Booted container");

    onStatus?.("Mounting filesystem");
    container.mount({
      ...file(".jshrc", [
        'export PNPM_HOME="/home/.pnpm"',
        'export PATH="/bin:/usr/bin:/usr/local/bin:/home/.pnpm"',
        'alias ni="npx -y --package=@antfu/ni -- ni"',
      ]),
      ...(options?.filesystem ?? {}),
    });
    onStatus?.("Mounted filesystem");

    onStatus?.("Moving jshrc");
    await container.spawn("mv", [".jshrc", "/home/.jshrc"]);
    onStatus?.("Moved jshrc");

    onStatus?.("Creating terminal");
    const xterm = new Terminal({ convertEol: true });
    const addon = new FitAddon();
    const { cols, rows } = xterm;
    xterm.loadAddon(addon);
    onStatus?.("Created terminal");

    onStatus?.("Spawning jsh");
    const jsh = await container.spawn("jsh", {
      env: {},
      terminal: { cols, rows },
    });
    onStatus?.("Spawned jsh");

    onStatus?.("Reading jsh output");
    const reader = jsh.output.getReader();
    const input = jsh.input.getWriter();
    await reader.read();
    reader.releaseLock();
    onStatus?.("Read jsh output");

    onStatus?.("Setting up terminal");
    xterm.onData((data) => input.write(data));
    jsh.output.pipeTo(new WritableStream({
      write: (data) => xterm.write(data),
    }));
    xterm.clear();
    onStatus?.("Setup terminal");

    return new OperatingSystem(container, jsh, xterm, addon);
  }
}