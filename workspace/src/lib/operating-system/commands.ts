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
    return "open " + Commands.Escape(Commands.SanitizePath(path));
  }

  private static readonly FilenameChars = {
    Forbidden: ['/', '\0', '"', '?', '\\'] as const,
    Discouraged: [':', '*', '<', '>', '|', ' '] as const,
  }

  public static CheckFileName = (filename: string) => {
    type ForbiddenChar = typeof Commands.FilenameChars.Forbidden[number];
    type DiscouragedChar = typeof Commands.FilenameChars.Discouraged[number];

    const forbidden: ForbiddenChar[] = [];
    const discouraged: DiscouragedChar[] = [];

    for (const char of Commands.FilenameChars.Forbidden)
      if (filename.includes(char))
        forbidden.push(char);

    for (const char of Commands.FilenameChars.Discouraged)
      if (filename.includes(char))
        discouraged.push(char);

    return forbidden.length || discouraged.length
      ? { forbidden, discouraged }
      : undefined;
  }

  private static Escape = (str: string) =>
    str
      .replace(/'/g, "\\'")
      .replace(/\|/g, "\\|")
      .replace(/\\/g, "\\\\")
      .replace(/</g, "\\<")
      .replace(/>/g, "\\>");

  private static SanitizePath = (path: string) =>
    Commands.PathRequiresQuotes(path) ? `"${path}"` : path;

  private static PathRequiresQuotes = (str: string) =>
    /[^A-Za-z0-9._\/-]/.test(str) ||   // any special shell character
    str !== str.trim() ||              // leading/trailing whitespace
    /(^-)/.test(str)                   // starts with a dash (could be mistaken as a flag)
}