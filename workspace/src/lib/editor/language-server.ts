
import { MonacoLanguageClient, } from "monaco-languageclient";
import type { MessageReader, MessageWriter, DataCallback, } from 'vscode-jsonrpc';
import type { WebContainerProcess, WebContainer } from "@webcontainer/api";
import stripAnsi from "strip-ansi";
import { Uri } from "@codingame/monaco-vscode-editor-api";
import { ready, announce, starting } from "@readmeseemore/language-servers-interop";

const createReader = (process: WebContainerProcess, log = false): MessageReader => {
  let onData: DataCallback;
  const stream = new WritableStream<string>({
    write: (chunk) => {
      const stripped = stripAnsi(chunk);
      try {
        if (stripped.startsWith("Content-Length:")) return;
        const parsed = JSON.parse(stripped);
        if (parsed.jsonrpc) {
          onData?.(parsed);
          if (log) console.log("received jsonrpc message", parsed);
        } else if (log)
          console.log("received non-jsonrpc message", parsed);
      }
      catch (e) {
        if (log && announce.is(stripped)) console.log("[FROM LANGUAGE SERVER]", stripped);
        else console.error("Unable to parse chunk", stripped, e);
      }
    }
  });
  const controller = new AbortController();
  process.output.pipeTo(stream, { signal: controller.signal });
  return {
    onError: () => ({ dispose: () => { } }),
    onClose: () => ({ dispose: () => { } }),
    onPartialMessage: () => ({ dispose: () => { } }),
    listen: (cb) => {
      onData = cb;
      return { dispose: () => { } }
    },
    dispose: () => {
      controller.abort("dispose");
    }
  }
}

const createWriter = (process: WebContainerProcess, log = false): MessageWriter => {
  const writer = process.input.getWriter();
  const end = () => {
    writer.releaseLock();
  }
  return {
    onError: () => ({ dispose: () => { } }),
    onClose: () => ({ dispose: () => { } }),
    write: (chunk) => {
      if (log) console.log("write", chunk);
      const payload = JSON.stringify(chunk);
      return writer.write(`Content-Length: ${payload.length}\r\n\r\n${payload}`);
    },
    end,
    dispose: end
  }
}

const transports = (process: WebContainerProcess, log = false) => ({
  reader: createReader(process, log),
  writer: createWriter(process, log),
})

export const createLanguageClient = async (process: WebContainerProcess, id: string, log = false) => {
  const languageClient = new MonacoLanguageClient({
    name: `${id} Language Client`,
    clientOptions: {
      workspaceFolder: {
        name: "workspace",
        uri: Uri.parse("file:///home/workspace/"),
        index: 0,
      },
      documentSelector: [id],
      errorHandler: {
        error: (error, msg, count) => {
          console.error(`${id} Language server error`, { error, msg, count });
          return { action: /*ErrorAction.Continue*/ 1 }
        },
        closed: () => {
          console.error(`${id} Language server closed`);
          return { action: /*CloseAction.DoNotRestart*/ 1 }
        }
      }
    },
    messageTransports: transports(process, log),
  });

  await languageClient.start();
  return languageClient;
}

export const spawnLanguageServer = async (
  container: WebContainer,
  dependency: string,
  options?: { flags?: string[], options?: Record<string, string>, arguments?: string[] },
) => {
  const flags = options?.flags?.map(f => `--${f}`) ?? [];
  const opts = options?.options ?? {};
  const args = options?.arguments ?? [];
  const proc = await container.spawn("npx", [
    "--yes",
    dependency,
    ...args,
    ...flags,
    ...Object.entries(opts).flatMap(([k, v]) => [`--${k}`, v]),
  ]);

  const reader = proc.output.getReader();
  let msg: string = "";

  const loop = async (fn?: (msg: string) => void) => {
    const { value } = await reader.read();
    msg = stripAnsi(value ?? "").trim();
    fn?.(msg);
  }

  while (!starting.is(msg)) await loop(console.log);
  console.log(`Language server process for ${dependency} has started...`);
  while (!ready.is(msg)) await loop(console.log);
  reader.releaseLock();

  return proc;
}