import type { WebContainerProcess } from "@webcontainer/api";
import { type SupportedLanguage, onEditorInit } from "./index.js";
import { createLanguageClient, spawnLanguageServer } from "$lib/editor/language-server.js";
import type OperatingSystem from "$lib/OperatingSystem.js";
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

const highlight = {
  typescript: takeActionOnlyOnce(
    () => import("@codingame/monaco-vscode-typescript-basics-default-extension"))
};

const typescript = async (payload: Payload) => {
  highlight.typescript(payload);
  const { os } = payload;
  if (!(await exists(os.container.fs, "./node_modules/typescript")))
    await os.enqueueCommand("npm install typescript", true);
  standardLanguageClient("typescript", payload);
};

export const actionsByLanguage = {
  "javascript": typescript,
  typescript: typescript,
  svelte: (payload) => standardLanguageClient("svelte", payload)
} satisfies Partial<Record<SupportedLanguage, Action>>;


export const takeAction = (language: string | undefined, payload: Payload) => {
  if (!language || !(language in actionsByLanguage)) return;
  actionsByLanguage[language as keyof typeof actionsByLanguage]?.(payload);
};