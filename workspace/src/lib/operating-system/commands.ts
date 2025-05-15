import { dirname, entry as getEntry, exists } from "$lib/utils/fs.js";
import OperatingSystem from "./os.js";

export class Commands {
  constructor(private readonly os: OperatingSystem) {

  }

  private async entry(path: string) {
    const entry = await getEntry(this.os.container.fs, path);
    if (!entry) throw new Error(`Path does not exist: ${path}`);
    return entry;
  }

  private async enqueue(command: string) {
    const terminal = await this.os.terminal;
    await terminal.enqueueCommand(command, true);
  }

  public async touch(path: string) {
    await this.enqueue("touch " + Commands.SanitizePath(path));
  }

  public async mkdir(path: string) {
    const dir = dirname(path);
    await exists(this.os.container.fs, dir, false) ?
      await this.enqueue("mkdir " + Commands.SanitizePath(path)) :
      await this.enqueue("mkdir --parents " + Commands.SanitizePath(path));
  }

  public async rm(path: string) {
    const entry = await this.entry(path);
    entry.isDirectory()
      ? await this.enqueue("rm --recursive " + Commands.SanitizePath(path))
      : await this.enqueue("rm " + Commands.SanitizePath(path));
  }

  public async cp(path: string) {
    const entry = await this.entry(path);
    if (entry.isDirectory()) {

    }
    else {

    }
  }

  public async mv(source: string, destination: string) {
    await this.enqueue(`mv ${Commands.SanitizePath(source)} ${Commands.SanitizePath(destination)}`);
  }

  public open(path: string) {
    return this.enqueue("open " + Commands.SanitizePath(Commands.EscapeNonAlphanumeric(path)));
  }

  private static PathRequiresQuotes = (path: string) =>
    /[^a-zA-Z0-9._\/-]/.test(path);

  private static SanitizePath = (path: string) =>
    Commands.PathRequiresQuotes(path) ? `"${path}"` : path;

  private static EscapeNonAlphanumeric = (path: string) =>
    path.replace(/[^a-zA-Z0-9._\/-]/g, "\\$&");
}