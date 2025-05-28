import { Terminal } from "$lib/operating-system/index.js";
import { notImplemented } from "../harness.js";

export const testTerminal = async (exitCode = 0) => {
  type TerminalParameters = Parameters<typeof Terminal.New>;
  const { readable: output, writable } = new TransformStream();
  const webcontainerMock: TerminalParameters[0] = {
    spawn: async () => {
      return {
        ...notImplemented("kill"),
        resize: () => { },
        exit: Promise.resolve(exitCode),
        output,
        input: new WritableStream(),
      }
    }
  };
  const write = async (content: string) => {
    const writer = writable.getWriter();
    await writer.write(new TextEncoder().encode(content));
    writer.releaseLock();
  }
  write("testing... is this thing on?")
  const terminal = await Terminal.New(webcontainerMock);
  return { terminal, write };
};