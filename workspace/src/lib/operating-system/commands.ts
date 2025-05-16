import { dirname, entry as getEntry, exists, type WithLimitFs } from "$lib/utils/fs.js";

export class Commands {
  constructor(private readonly fs: WithLimitFs<"readdir">) {

  }

  private async entry(path: string) {
    const entry = await getEntry(this.fs, path);
    if (!entry) throw new Error(`Path does not exist: ${path}`);
    return entry;
  }

  public touch(path: string) {
    return "touch " + Commands.SanitizePath(path);
  }

  public async mkdir(path: string, assumeExists = false) {
    const dir = dirname(path);
    return assumeExists || await exists(this.fs, dir, false) ?
      "mkdir " + Commands.SanitizePath(path) :
      "mkdir --parents " + Commands.SanitizePath(path);
  }

  public async rm(path: string) {
    const entry = await this.entry(path);
    return entry.isDirectory()
      ? "rm --recursive " + Commands.SanitizePath(path)
      : "rm " + Commands.SanitizePath(path);
  }

  public async cp(path: string) {
    const entry = await this.entry(path);
    if (entry.isDirectory()) {

    }
    else {

    }
  }

  public mv(source: string, destination: string) {
    return `mv ${Commands.SanitizePath(source)} ${Commands.SanitizePath(destination)}`;
  }

  public open(path: string) {
    return "open " + Commands.SanitizePath(Commands.EscapeNonAlphanumeric(path));
  }

  private static PathRequiresQuotes = (path: string) =>
    /[^a-zA-Z0-9._\/-]/.test(path);

  private static SanitizePath = (path: string) =>
    Commands.PathRequiresQuotes(path) ? `"${path}"` : path;

  private static EscapeNonAlphanumeric = (path: string) =>
    path.replace(/[^a-zA-Z0-9._\/-]/g, "\\$&");
}