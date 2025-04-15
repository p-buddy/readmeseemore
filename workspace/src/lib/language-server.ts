
import { MonacoLanguageClient } from "monaco-languageclient";
import { createMessageConnection, NotificationType, type MessageConnection, type MessageReader, type MessageWriter, type DataCallback } from 'vscode-jsonrpc';
import type { WebContainerProcess, WebContainer } from "@webcontainer/api";
import stripAnsi from "strip-ansi";
import { Uri } from "@codingame/monaco-vscode-editor-api";

const createReader = (process: WebContainerProcess, log = false): MessageReader => {
  let onData: DataCallback;
  const stream = new WritableStream<string>({
    write: (chunk) => {
      try {
        const parsed = JSON.parse(stripAnsi(chunk));
        if (parsed.jsonrpc) {
          onData?.(parsed);
          if (log) console.log("received jsonrpc message", parsed);
        } else if (log)
          console.log("received non-jsonrpc message", parsed);
      }
      catch (e) {
        if (log && chunk.startsWith("(LS)")) console.log("Msg from Language Server", chunk);
        else console.error("Unable to parse chunk", chunk, e);
      }
    }
  });
  process.output.pipeTo(stream);
  return {
    onError: () => ({ dispose: () => { } }),
    onClose: () => ({ dispose: () => { } }),
    onPartialMessage: () => ({ dispose: () => { } }),
    listen: (cb) => {
      onData = cb;
      return { dispose: () => { } }
    },
    dispose: () => {
      stream.close();
    }
  }
}

const createWriter = (process: WebContainerProcess, log = false): MessageWriter => {
  const writer = process.input.getWriter();
  const end = () => {
    writer.close();
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
        error: () => ({ action: /*ErrorAction.Continue*/ 1 }),
        closed: () => ({ action: /*CloseAction.DoNotRestart*/ 1 })
      }
    },
    messageTransports: transports(process, log),
  });

  await languageClient.start();
  return languageClient;
}

export class ConnectionTester {
  connection: MessageConnection;

  constructor(process: WebContainerProcess) {
    const reader = createReader(process, true);
    const writer = createWriter(process, true);
    this.connection = createMessageConnection(reader, writer);
    this.connection.inspect();
    this.connection.listen();
    this.connection.onError(e => console.trace(e));
  }

  async test(method: string, params: any) {
    const notification = new NotificationType<string>(method);
    await this.connection.sendNotification(notification, params);
  }
}

const startIndicator = "READY";

export const spawnLanguageServer = async (container: WebContainer, name: string, options?: { flags?: string[], options?: Record<string, string>, arguments?: string[] }, pkgPrefix = "@readmeseemore/") => {
  const flags = options?.flags?.map(f => `--${f}`) ?? [];
  const opts = options?.options ?? {};
  const args = options?.arguments ?? [];
  const proc = await container.spawn("npx", [
    "--yes",
    `${pkgPrefix}${name}`,
    ...args,
    ...flags,
    ...Object.entries(opts).flatMap(([k, v]) => [`--${k}`, v]),
  ]);

  const reader = proc.output.getReader();
  let msg: string = "";
  while (msg !== startIndicator) {
    const { value } = await reader.read();
    msg = stripAnsi(value ?? "").trim();
    console.log(msg);
  }
  reader.releaseLock();

  return proc;
}