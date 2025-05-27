import { Terminal } from "$lib/operating-system/index.js";
import { notImplemented } from "../harness.js";

export const testTerminal = async (exitCode = 0) => {
  type TerminalParameters = Parameters<typeof Terminal.New>;
  const { readable: output, writable } = new TransformStream();
  const input = new WritableStream();

  const webcontainerMock: TerminalParameters[0] = {
    spawn: async () => {
      return {
        ...notImplemented("kill"),
        ...notImplemented("resize"),
        exit: Promise.resolve(exitCode),
        output,
        input,
      }
    }
  };
  const terminal = await Terminal.New(webcontainerMock);

  // Return both the terminal and a write function
  return {
    terminal,
    write: async (content: string) => {
      const writer = writable.getWriter();
      await writer.write(new TextEncoder().encode(content));
      writer.releaseLock();
    }
  };
}