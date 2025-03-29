import { resolve, dirname, join, extname, isAbsolute, parse } from "path";
import { existsSync, statSync } from "fs";
import { exports } from 'resolve.exports';
import type { Package } from './Reporter';

export class Regex {
  static readonly CaptureAllString = "(.+)";
  static readonly EscapeSpecial = (text: string) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
  static readonly CaptureHashtagID = () => new RegExp(/#([a-zA-Z0-9_-]+)/);
  static readonly MatchSurroundingBracesAndWhitespace = () => new RegExp(/(?:\h*^{\n*)|(?:\s*}$)/g);
  static readonly CaptureLeadingWhitespace = () => new RegExp(/^(\s+)/);
  static readonly MatchTsJsExtension = () => new RegExp(/\.(?:ts|js)$/);
  static readonly MatchTrailingIndex = () => new RegExp(/\/index$/);
  static readonly MatchLeadingHashtag = () => new RegExp(/^#/);
  static readonly MatchExtension = () => /\.[^.]+$/;
  static readonly MatchLeadingDotSlash = () => new RegExp(/^\.\//);
  static readonly MatchWindowsSlash = () => new RegExp(/\\/g);
  static readonly MatchAnchoredPath = () => new RegExp(/^(?:\/|[a-zA-Z]:\/|\.\.?\/)/);
}

const unixJoin = (...paths: string[]) => join(...paths).replace(Regex.MatchWindowsSlash(), '/');

export function createReverseExportLookup({ details, path }: Package<"name">) {
  if (details.exports && typeof details.exports === 'string')
    details.exports = { ".": details.exports };

  const { name, exports: exportsField, main } = details;

  const absolutify = (location: string) => resolve(dirname(path), location);

  const process = (exported: string) =>
    exports(details, exported, { conditions: ['import', 'default'] })?.
      forEach(location => reverseMap.set(absolutify(location), unixJoin(name, exported)));

  const reverseMap = new Map<string, string>();

  if (main) reverseMap.set(absolutify(main), name);

  if (exportsField)
    if (typeof exportsField === 'string' || Array.isArray(exportsField))
      throw new Error('Top level exports is expected to be an object')
    else Object.keys(exportsField).forEach(process);

  return reverseMap;
}

/**
 * Given a relative import path specifier (e.g. `./path/to/module` as in `import _ from "./path/to/module"`), return all possible absolute file paths that could match it.
 * This is useful for finding the correct file when the relative path is ambiguous.
 * 
 * @param specifier - The relative file path to convert to an absolute path.
 * @param sourceFileDir - The absolute path to the directory of the source file that contains the relative path.
 */
export const getAbsoluteFileCandidates = (specifier: string, sourceFileDir: string): string[] => {
  let base = resolve(sourceFileDir, specifier);
  if (extname(base)) return [base];
  const extensions = [".ts", ".js", ".cjs", ".mjs"];
  return [...extensions.map(ext => base + ext), ...extensions.map(ext => unixJoin(base, "index" + ext))];
}

export const getAbsoluteDirname = (absoluteOrRelativePath: string, potentiallyRelativeTo: string) => {
  const pathTo = dirname(absoluteOrRelativePath);
  return isAbsolute(pathTo) ? pathTo : resolve(potentiallyRelativeTo, pathTo);
}

const fileExists = (filepath: string) => existsSync(filepath) && statSync(filepath).isFile();

export function tryFindClosestFileMatch({ startingPointDir, specifiers, error }:
  {
    startingPointDir: string,
    specifiers: string[],
    error?: (message: string) => void
  }
): string | undefined {
  const { root } = parse(startingPointDir);
  let dir = startingPointDir;

  const specifierToPath = (name: string) => join(dir, name);

  while (true) {
    const candidates = specifiers.map(specifierToPath).filter(fileExists);

    switch (candidates.length) {
      case 0: break;
      case 1: return candidates[0];
      default:
        error?.(`Multiple matching files found in ${dir}:` + ["", ...candidates].join("\n-"));
        return undefined;
    }

    if (dir === root) break;
    dir = dirname(dir);
  }

  return undefined;
}