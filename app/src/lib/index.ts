import { WebContainer, type FileSystemTree, type WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper";
import { Terminal, type ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";

const cliFlags = {
  npx: {
    yesToAll: "-y",
  },
  chokidar: {
    ignore: "-i",
  }
}

type FsChange = {
  action: "add" | "unlink" | "addDir" | "unlinkDir",
  type: "file" | "folder",
  path: string,
}

type FsChangeCallback = (change: FsChange) => any;

export class OperatingSystem {
  private constructor(
    public readonly container: WebContainer,
    public readonly xterm: Terminal,
    public readonly jsh: WebContainerProcess,
    public readonly fitXterm: () => void,
    public readonly onFsChange: (callback: FsChangeCallback) => void,
  ) { }

  private static instance: OperatingSystem | null = null;

  static async Create(filesystem?: FileSystemTree, terminalTheme?: ITheme) {
    OperatingSystem.instance ??= await OperatingSystem.Factory(filesystem);
    OperatingSystem.instance.xterm.options.theme = terminalTheme;
    return OperatingSystem.instance;
  }

  private static async Factory(filesystem?: FileSystemTree) {
    const container = await WebContainer.boot();

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

    const watchConfig = {
      command: "chokidar-cli",
      directory: ".",
      ignore: '"(**/(node_modules|.git|_tmp_)**)"'
    }

    const fsChangeCallbacks = new Set<FsChangeCallback>();
    let isReady: boolean | null = null;

    const watch = await container.spawn('npx', [
      cliFlags.npx.yesToAll,
      watchConfig.command,
      watchConfig.directory,
      cliFlags.chokidar.ignore,
      watchConfig.ignore,
    ]);

    watch.output.pipeTo(new WritableStream({
      async write(data) {
        isReady ??= data.includes(`Watching "${watchConfig.directory}"`) ? true : null;
        if (!isReady) return;

        const action: string = data.split(':').at(0) || '';
        const path = data.split(':').at(1)?.trim() || '';
        console.log(action, path);

        switch (action) {
          case 'add':
          case 'unlink':
            fsChangeCallbacks.forEach(callback => callback({ action, path, type: "file" }));
            break;
          case 'addDir':
          case 'unlinkDir':
            fsChangeCallbacks.forEach(callback => callback({ action, path, type: "folder" }));
            break;
        }
      }
    }));

    const reader = jsh.output.getReader();
    const input = jsh.input.getWriter();
    await reader.read();
    reader.releaseLock();

    xterm.onData((data) => input.write(data));
    jsh.output.pipeTo(new WritableStream({
      write: (data) => xterm.write(data),
    }));
    xterm.clear();
    const fitXterm = () => addon.fit();
    return new OperatingSystem(container, xterm, jsh, fitXterm, (callback) => fsChangeCallbacks.add(callback));
  }
}