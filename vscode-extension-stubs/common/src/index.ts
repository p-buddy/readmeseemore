import { tmpdir, } from "node:os";
import { writeFile, mkdtemp, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, extname, basename, relative } from "node:path";
import extract from 'extract-zip';
import { dedent } from 'ts-dedent';
import { expand, Json, localFileRegex, Meta, ResourceDirectory, subset, urlToAbsolute } from "./utils";

type Details = Record<"publisher" | "extension" | "version", string>;

export const url = (details: Details) => [
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers",
  details.publisher,
  "vsextensions",
  details.extension,
  details.version,
  "vspackage",
].join("/");

export const vsix = {
  downloadTo: async (details: Details, destFile: string): Promise<void> => {
    const _url = url(details);
    console.log(`Downloading VSIX from: ${_url}`);
    const res = await fetch(_url);
    if (!res.ok) throw new Error(`Failed to download VSIX (HTTP ${res.status})`);
    const data = Buffer.from(await res.arrayBuffer());
    await writeFile(destFile, data);
    console.log(`Downloaded VSIX to ${destFile}`);
  },
  extractTo: async (vsixFile: string, destDir: string): Promise<void> => {
    console.log(`Extracting VSIX to ${destDir} ...`);
    try {
      await extract(vsixFile, { dir: destDir });
    } catch (err) {
      throw new Error(`Extraction failed: ${err}`);
    }
    console.log(`Extraction complete.`);
  },
  paths: async ({ publisher, extension, version }: Details) => ({
    vsix: join(tmpdir(), `${publisher}.${extension}-${version}.vsix`),
    extraction: await mkdtemp(join(tmpdir(), `${publisher}-${extension}-${version}`)),
  }),
  download: async (details: Details) => {
    const paths = await vsix.paths(details);

    if (existsSync(paths.vsix)) console.log(`VSIX file already exists: ${paths.vsix}`);
    else await vsix.downloadTo(details, paths.vsix);

    await vsix.extractTo(paths.vsix, paths.extraction);

    console.log(`Extension extracted to: ${paths.extraction}`);

    return paths.extraction;
  }
}

export const getVsixStructure = async (details: Details) => {
  const parent = await vsix.download(details);
  const files = await readdir(parent, { withFileTypes: true, recursive: true });
  return {
    parent,
    files,
    tryRelativeToAbsolute(path: string) {
      const full = join(parent, path);
      const match = files.find(file => expand(file) === full);
      return match ? expand(match) : null;
    }
  }
}

type Structure = Awaited<ReturnType<typeof getVsixStructure>>;

export const getPackageJsonSubset = async (
  structure: Structure,
  relative: string,
  ...keys: (string | Record<string, string[]>)[]
) => {
  const path = structure.tryRelativeToAbsolute(relative);
  if (!path) throw new Error(`package.json not found at: ${path}`);
  return { json: subset(JSON.parse(await readFile(path, "utf-8")), ...keys), path };
}

type PackageJsonPayload = Awaited<ReturnType<typeof getPackageJsonSubset>>;

export const findAllFileReferences = (json: PackageJsonPayload["json"]) => {
  const results: {
    path: string;
    value: string;
  }[] = [];

  function recurse(current: Json, path: string = "error") {
    if (typeof current === "string") {
      if (localFileRegex.test(current))
        results.push({ path, value: current });
    } else if (Array.isArray(current))
      current.forEach((item, idx) => recurse(item, `${path}[${idx}]`));
    else if (current !== null && typeof current === "object")
      for (const [key, val] of Object.entries(current))
        recurse(val, `${path}.${key}`);
  }

  recurse(json);
  return results;
}

const register = async (
  paths: Record<"virtual" | "actual" | "relativeToRefferer", string>,
  resources: ResourceDirectory
) => {
  const { virtual, actual, relativeToRefferer } = paths;
  const buffer = await readFile(actual);
  const size = buffer.length;
  const details = extname(virtual) === ".json"
    ? { size, mimeType: "application/json" }
    : { size };
  await resources.write(basename(virtual), buffer.toString("utf-8"));
  const location = `new URL('${relativeToRefferer}', import.meta.url).toString()`;
  return `registerFileUrl('${virtual}', ${location}, ${JSON.stringify(details)});`
}

export const populate = async (
  { json, path }: PackageJsonPayload,
  meta: Meta,
  { main, resources }: Record<"main" | "resources", string>
) => {
  const _resources = new ResourceDirectory(meta, resources);
  await _resources.clear();

  main = urlToAbsolute(meta, main);

  const toResources = relative(dirname(main), _resources.directory);
  const fromReferer = (path: string) => {
    const relativeToReferer = join(toResources, basename(path));
    return relativeToReferer.startsWith(".") ? relativeToReferer : `./${relativeToReferer}`;
  }

  const entries = await Promise.all(
    findAllFileReferences(json)
      .map(async ({ value: virtual }) => {
        const actual = resolve(dirname(path), virtual);
        const relativeToRefferer = fromReferer(virtual);
        return register({ actual, virtual, relativeToRefferer }, _resources);
      })
  );

  await writeFile(main, `
/** THIS FILE IS GENERATED. MANUAL EDITS WILL NOT BE PRESERVED. */
import { registerExtension } from '@codingame/monaco-vscode-api/extensions';

const manifest = ${JSON.stringify(json, null, 2)};

const registration = registerExtension(manifest, undefined, {"system":true});

// @ts-ignore - TODO: determine why \`registerFileUrl\` does not exist on the return of \`registerExtension\`
const { whenReady, registerFileUrl } = registration;

${entries.join("\n")}
${await register({
    virtual: "package.json",
    actual: path,
    relativeToRefferer: fromReferer(path)
  }, _resources)}

export { whenReady }; `.trim());

  await writeFile(join(dirname(main), "index.d.ts"), `
  declare const whenReady: () => Promise<void>
  export { whenReady }
`.trim());

  await Promise.all([
    writeFile(
      main,
      dedent`
      /** THIS FILE IS GENERATED. MANUAL EDITS WILL NOT BE PRESERVED. */
      import { registerExtension } from '@codingame/monaco-vscode-api/extensions';

      const manifest = ${JSON.stringify(json, null, 2)};

      const registration = registerExtension(manifest, undefined, {"system":true});

      // @ts-ignore - TODO: determine why \`registerFileUrl\` does not exist on the return of \`registerExtension\`
      const { whenReady, registerFileUrl } = registration;

      ${entries.join("\n")}
      ${await register({
        virtual: "package.json",
        actual: path,
        relativeToRefferer: fromReferer(path)
      }, _resources)}

      export { whenReady };
      `),

    writeFile(
      join(dirname(main), "index.d.ts"),
      dedent`
      declare const whenReady: () => Promise<void>
      export { whenReady }
      `)
  ]);

  console.log(`Wrote ${main} and corresponding index.d.ts`);
}