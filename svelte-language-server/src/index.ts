import { StreamMessageReader, StreamMessageWriter } from './jsonrpc';
import { createConnection, createServerProcess, forward } from 'vscode-ws-jsonrpc/server';
import { Message, InitializeRequest, type InitializeParams } from 'vscode-languageserver-protocol';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { name as packageName } from '../package.json';

let server: ReturnType<typeof createServerProcess>;

const createServer = (name: string) => {
  if (server) return server;
  const { url } = import.meta;
  const path = fileURLToPath(url).split(packageName)[0];
  const script = join(path, "svelte-language-server", "bin", "server.js");
  return (server = createServerProcess(name, 'node', [script, "--stdio"]));
}

const msgPrefix = "(LS)";
const name = "Svelte";

const announce = (msg: string, payload?: any) => console.log(
  `${msgPrefix} (${name}) ${msg}${payload ? ":\n" + JSON.stringify(payload) : ""}`
);

export const start = (log = false) => {
  process.stdin.setRawMode(true);

  const reader = new StreamMessageReader(process.stdin, "utf-8");
  const writer = new StreamMessageWriter(process.stdout, "utf-8");

  const processConnection = createConnection(reader, writer, () => {
    announce("dispose");
    reader.dispose();
    writer.dispose();
  });

  const serverConnection = createServer(name);

  if (!serverConnection)
    throw new Error('Failed to spawn Svelte Language Server');

  forward(processConnection, serverConnection, message => {
    if (Message.isRequest(message)) {
      if (message.method === InitializeRequest.type.method) {
        const initializeParams = message.params as InitializeParams;
        initializeParams.processId = process.pid;
      }

      if (log) announce(`Server received: ${message.method}`, message);
    }

    if (Message.isResponse(message) && log)
      announce(`Server sent:`, message);

    if (Message.isNotification(message) && log)
      announce(`Server notification:`, message);

    return message;
  });

  console.log("READY");
}