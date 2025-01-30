import { WebContainer, type FileSystemTree, type WebContainerProcess } from "@webcontainer/api";
import { file } from "./utils/fs-helper";
import { Terminal, type ITheme } from "xterm";
import { FitAddon } from "xterm-addon-fit";

export class OperatingSystem {
  private constructor(
    public readonly container: WebContainer,
    public readonly xterm: Terminal,
    public readonly jsh: WebContainerProcess,
    public readonly fitXterm: () => void
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
    return new OperatingSystem(container, xterm, jsh, fitXterm);
  }
}