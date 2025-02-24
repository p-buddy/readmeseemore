import type { WebContainer, FileSystemTree, WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper";
import { Terminal, type ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { boot } from "./webcontainer";
import { deferred } from "./utils";

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

export class OperatingSystem {
  private constructor(
    public readonly container: WebContainer,
    public readonly jsh: WebContainerProcess,
    public readonly xterm: Terminal,
    private readonly fitAddon: FitAddon,
  ) { }

  private static instance: OperatingSystem | null = null;

  public async watch(callback: FsChangeCallback, onReady?: () => void) {
    const watchConfig = {
      command: "chokidar-cli",
      directory: ".",
      ignore: '"(**/(node_modules|.git|_tmp_)**)"'
    } as const;

    const watch = await this.container.spawn('npx', [
      cliFlags.npx.yesToAll,
      watchConfig.command,
      watchConfig.directory,
      cliFlags.chokidar.ignore,
      watchConfig.ignore,
    ]);

    let ready: boolean = false;

    watch.output.pipeTo(new WritableStream({
      async write(data) {
        if (!ready) {
          ready = data.includes(`Watching "${watchConfig.directory}"`);
          if (!ready) return;
          onReady?.();
        }

        const action: string = data.split(':').at(0) || '';
        const path = data.split(':').at(1)?.trim() || '';

        switch (action) {
          case 'add':
          case 'unlink':
            callback({ action, path, type: "file" });
            break;
          case 'addDir':
          case 'unlinkDir':
            callback({ action, path, type: "folder" });
            break;
        }
      }
    }));
  }

  public fitXterm() {
    this.fitAddon.fit();
  }

  static async Create(filesystem?: FileSystemTree, terminalTheme?: ITheme) {
    OperatingSystem.instance ??= await OperatingSystem.Factory(filesystem);
    OperatingSystem.instance.xterm.options.theme = terminalTheme;
    return OperatingSystem.instance;
  }

  private static async Factory(filesystem?: FileSystemTree) {
    const container = await boot();

    container.mount({
      ...file(".jshrc", [
        'export PNPM_HOME="/home/.pnpm"',
        'export PATH="/bin:/usr/bin:/usr/local/bin:/home/.pnpm"',
        'alias ni="npx -y --package=@antfu/ni -- ni"',
      ]),
      ...(filesystem ?? {}),
    });

    await container.spawn("mv", [".jshrc", "/home/.jshrc"]);

    const xterm = new Terminal({ convertEol: true });
    const addon = new FitAddon();
    const { cols, rows } = xterm;
    xterm.loadAddon(addon);

    const jsh = await container.spawn("jsh", {
      env: {},
      terminal: { cols, rows },
    });

    const reader = jsh.output.getReader();
    const input = jsh.input.getWriter();
    await reader.read();
    reader.releaseLock();

    xterm.onData((data) => input.write(data));
    jsh.output.pipeTo(new WritableStream({
      write: (data) => xterm.write(data),
    }));
    xterm.clear();
    return new OperatingSystem(container, jsh, xterm, addon);
  }
}