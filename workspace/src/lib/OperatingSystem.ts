import type { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper.js";
import { Terminal, type ITheme } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { boot, teardown, workdirName } from "./utils/webcontainer.js";

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
  status?: (status: string) => void,
  force?: boolean,
}

export default class OperatingSystem {
  private onChange?: Set<FsChangeCallback>;
  private _watch?: Promise<WebContainerProcess>;

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
    this._watch ??= OperatingSystem.Watch(this.container, this.onChange);
    await this._watch;
  }

  public fitXterm() {
    this.fitAddon.fit();
  }

  public async clearFileSystem() {
    const { container } = this;
    const rm = await container.spawn("rm", ["-rf", "./*"]);
    await rm.exit;
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
    const xterm = new Terminal({ convertEol: true });
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

    status?.("Setting up terminal");
    xterm.onData((data) => input.write(data));
    jsh.output.pipeTo(new WritableStream({
      write: (data) => xterm.write(data),
    }));
    xterm.clear();

    return new OperatingSystem(container, jsh, xterm, addon);
  }
}