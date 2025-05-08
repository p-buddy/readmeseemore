import { WebContainer, type WebContainerProcess } from "@webcontainer/api";

export type Status = (status: string) => void;

export const cli = {
  flags: {
    npx: {
      yesToAll: "-y",
    },
    chokidar: {
      ignore: "-i",
      followSymlinks: "-s",
    }
  },
  input: {
    prompt: {
      default: "\u001b[1G\u001b[0J\u001b[35m❯\u001b[39m \u001b[3G",
      error: "\u001b[1G\u001b[0J\u001b[31m❯\u001b[39m \u001b[3G",
      prefix: "❯ "
    },
    user: {
      return: "\r",
    },
    eol: String.fromCharCode(5),
    backspace: "\b",
  },
  output: {
    location: "~/workspace"
  }
} as const;
let webcontainer: WebContainer | null = null;

export const workdirName = "workspace";
export const root = `/home/${workdirName}/`;

export const boot = async () => {
  webcontainer ??= await WebContainer.boot({ workdirName, coep: 'require-corp' });

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
  };
};
