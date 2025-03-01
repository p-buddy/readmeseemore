import { WebContainer } from "@webcontainer/api";

let webcontainer: WebContainer | null = null;

export const boot = async () => {
  webcontainer ??= await WebContainer.boot({
    workdirName: "workspace",
  });

  return webcontainer;
};

export const teardown = () => {
  webcontainer?.teardown();
  webcontainer = null;
};
