const takeAction = <Fn extends (...args: any[]) => Promise<void>>(
  action: Fn,
) => {
  let taken = false;
  return async (...args: Parameters<Fn>) => {
    if (taken) return;
    taken = true;
    await action(...args);
  };
};

export const actionsByLanguage = {
  "typescript": takeAction(async () => {
    await import("@codingame/monaco-vscode-typescript-basics-default-extension");
    await import("@codingame/monaco-vscode-typescript-language-features-default-extension")
  })
}