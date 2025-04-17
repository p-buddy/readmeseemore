import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

let webcontainer: WebContainer | null = null;

export const workdirName = "workspace";
export const root = `/home/${workdirName}/`;

export const boot = async () => {
  webcontainer ??= await WebContainer.boot({ workdirName });

  return webcontainer;
};

export const teardown = () => {
  webcontainer?.teardown();
  webcontainer = null;
};

export const io = async (process: WebContainerProcess, output: (data: string) => void) => {
  const reader = process.output.getReader();
  await reader.read();
  reader.releaseLock();

  process.output.pipeTo(new WritableStream({
    write: (chunk) => output(chunk),
  }));

  const input = process.input.getWriter();
  const write = (chunk: string) => input.write(chunk);

  return {
    write,
  }
}