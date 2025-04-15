import type { WebContainer } from "@webcontainer/api";
import { type SupportedLanguage, onInit } from "./index.js";
import { ConnectionTester, createLanguageClient, spawnLanguageServer } from "$lib/language-server.js";
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
})

export const actionsByLanguage = {
  "typescript": typescript,
  "javascript": typescript,
  svelte: takeActionOnlyOnce(async ({ container }) => {
    const proc = await spawnLanguageServer(
      container,
      "svelte-language-server",
      {
        flags: ["verbose"],
      },
    );
    onInit(() => {
      const client = createLanguageClient(proc, "svelte", true);
      //new ConnectionTester(proc).test("testNotification", "Hello World");
    });
  })
} satisfies Partial<Record<SupportedLanguage, Action>>;

export const takeAction = (language: string | undefined, payload: Payload) => {
  if (!language || !(language in actionsByLanguage)) return;
  actionsByLanguage[language as keyof typeof actionsByLanguage]?.(payload);
};