import { WebContainer } from "@webcontainer/api";

let webcontainer: WebContainer | null = null;

export const workdirName = "workspace";

export const boot = async () => {
  webcontainer ??= await WebContainer.boot({ workdirName });

  return webcontainer;
};

export const teardown = () => {
  webcontainer?.teardown();
  webcontainer = null;
};
