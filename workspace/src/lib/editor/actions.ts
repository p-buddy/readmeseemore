import type { WebContainerProcess } from "@webcontainer/api";
import { type SupportedLanguage, onEditorInit } from "./index.js";
import { createLanguageClient, spawnLanguageServer } from "$lib/editor/language-server.js";
import type { OperatingSystem } from "$lib/operating-system/index.js";
import { exists } from "./utils.js";

type Payload = { os: OperatingSystem };

type Action = (payload: Payload) => any;

const takeActionOnlyOnce = (
  action: Action,
) => {
  let taken = false;
  return async (payload: Payload) => {
    if (taken) return;
    taken = true;
    await action(payload);
  };
};

type LanguageServer = {
  process: WebContainerProcess;
  client: Awaited<ReturnType<typeof createLanguageClient>>;
}

const spawnedLanguageServers = new Map<string, Promise<LanguageServer>>();

const spawnLanguageServerClient = async (
  id: string,
  params: Parameters<typeof spawnLanguageServer>,
  log = false
) => {
  if (spawnedLanguageServers.has(id)) return spawnedLanguageServers.get(id)!;
  const promise = new Promise<LanguageServer>(async (resolve) => {
    const process = await spawnLanguageServer(...params);
    onEditorInit(async () => {
      resolve({ process, client: await createLanguageClient(process, id, log) })
    });
  });
  spawnedLanguageServers.set(id, promise);
  return promise;
}

export const killSpawnedLanguageServer = async (id: string) => {
  if (!spawnedLanguageServers.has(id)) return false;
  const promise = spawnedLanguageServers.get(id)!;
  spawnedLanguageServers.delete(id);
  const { process, client } = await promise;
  try {
    await client.dispose();
    process.kill();
    return true;
  } catch (e) {
    console.error("error killing language server", e);
    return false;
  }
}

const standardLanguageClient = (lang: string, payload: Payload, verbose = false) => {
  const { os: { container } } = payload;
  const pkg = `@readmeseemore/language-servers-${lang}`;
  if (!verbose) spawnLanguageServerClient(lang, [container, pkg]);
  else spawnLanguageServerClient(lang, [container, pkg, { flags: ["verbose"] }], true);
}

const programmaticCommandComment = (lang: string, space = true) =>
  (space ? " " : "") +
  `# NOTE: This command was issued programmatically so ${lang} language features work correctly ツ`;

const highlight = {
  typescript: takeActionOnlyOnce(
    () => import("@codingame/monaco-vscode-typescript-basics-default-extension")),
  svelte: takeActionOnlyOnce(
    () => import("@readmeseemore/vscode-extension-stubs-svelte"))
};

const inprogress = new Map<string, Promise<void>>();

const ensurePackageExists = async ({ os }: Payload, pkg: string, dev = false) => {
  if (inprogress.has(pkg)) return;
  const check = new Promise<void>(async (resolve) => {
    const { container: { fs } } = os;
    if ((await exists(fs, "package.json", true))) {
      const { dependencies, devDependencies } = JSON.parse(
        await fs.readFile("package.json", "utf-8")
      );
      if (dependencies?.[pkg] || devDependencies?.[pkg])
        if (await exists(fs, `node_modules/${pkg}`)) return;
    }
    const cmd =
      "npm install" +
      (dev ? " --save-dev " : " ") +
      pkg +
      programmaticCommandComment(pkg.replace("@types/", ""));
    await os.terminal.enqueueCommand(cmd, true);
    resolve();
  });
  inprogress.set(pkg, check);
  await check;
  inprogress.delete(pkg);
}

const typescript = async (payload: Payload) => {
  highlight.typescript(payload);
  await ensurePackageExists(payload, "typescript");
  standardLanguageClient("typescript", payload);
};

export const actionsByLanguage = {
  typescript,
  javascript: (payload) => {
    typescript(payload);
    import("@codingame/monaco-vscode-javascript-default-extension");
  },
  svelte: async (payload) => {
    highlight.svelte(payload);
    await typescript(payload);
    standardLanguageClient("svelte", payload);
  },
  json: () => {
    import("@codingame/monaco-vscode-json-default-extension");
    import("@codingame/monaco-vscode-json-language-features-default-extension");
  },
  html: () => {
    import("@codingame/monaco-vscode-html-default-extension");
    import("@codingame/monaco-vscode-html-language-features-default-extension");
  },
  yaml: () => {
    import("@codingame/monaco-vscode-yaml-default-extension");
  },
  markdown: () => {
    import("@codingame/monaco-vscode-markdown-basics-default-extension");
    import("@codingame/monaco-vscode-markdown-language-features-default-extension");
  },
  xml: () => {
    import("@codingame/monaco-vscode-xml-default-extension");
  },
  css: () => {
    import("@codingame/monaco-vscode-css-default-extension");
    import("@codingame/monaco-vscode-css-language-features-default-extension");
  },
  react: async (payload) => {
    await typescript(payload);
    await ensurePackageExists(payload, "@types/react", true);
  }
} satisfies Partial<Record<SupportedLanguage, Action>>;


export const takeAction = (language: string | undefined, payload: Payload) => {
  if (!language || !(language in actionsByLanguage)) return;
  actionsByLanguage[language as keyof typeof actionsByLanguage]?.(payload);
};