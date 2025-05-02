import { getVsixStructure, getPackageJsonSubset, populate } from "@readmeseemore/vscode-extension-stubs-common";

(async () => {
  const structure = await getVsixStructure({
    publisher: "svelte",
    extension: "svelte-vscode",
    version: "109.5.4",
  });

  const pkg = await getPackageJsonSubset(
    structure,
    "extension/package.json",
    "name",
    "version",
    "displayName",
    "publisher",
    "engines",
    { contributes: ["languages", "grammars", "snippets"] }
  );

  await populate(pkg, import.meta, {
    main: "../dist/index.js",
    resources: "../dist/resources",
  });
})()