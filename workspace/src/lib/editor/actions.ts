import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { type SupportedLanguage, onInit } from "./index.js";
import { createLanguageClient, spawnLanguageServer } from "$lib/editor/language-server.js";
type Payload = {
  container: WebContainer;
};

type Action = (payload: Payload) => Promise<void>;

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

const typescript = takeActionOnlyOnce(async () => {
  await import("@codingame/monaco-vscode-typescript-basics-default-extension");
  await import("@codingame/monaco-vscode-typescript-language-features-default-extension")
});

type LanguageServer = {
  process: WebContainerProcess;
  client: Awaited<ReturnType<typeof createLanguageClient>>;
}

const spawnedLanguageServers = new Map<string, Promise<LanguageServer>>();

const spawnLanguageServerClient = async (id: string, params: Parameters<typeof spawnLanguageServer>, log = true) => {
  if (spawnedLanguageServers.has(id)) return spawnedLanguageServers.get(id)!;
  const promise = new Promise<LanguageServer>(async (resolve) => {
    const process = await spawnLanguageServer(...params);
    onInit(async () => {
      resolve({ process, client: await createLanguageClient(process, id, log) })
    });
  });
  spawnedLanguageServers.set(id, promise);
  console.log("spawning", id);
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

const pkg = <T extends string>(suffix: T) =>
  `@readmeseemore/language-servers-${suffix}` as const;

export const actionsByLanguage = {
  "javascript": typescript,
  typescript,
  svelte: async ({ container }) => {
    await spawnLanguageServerClient("svelte", [container, pkg("svelte"), { flags: ["verbose"] }]);
  }
} satisfies Partial<Record<SupportedLanguage, Action>>;


export const takeAction = (language: string | undefined, payload: Payload) => {
  if (!language || !(language in actionsByLanguage)) return;
  actionsByLanguage[language as keyof typeof actionsByLanguage]?.(payload);
};