import { StreamMessageReader, StreamMessageWriter } from './jsonrpc';
import { createConnection, createServerProcess, forward } from 'vscode-ws-jsonrpc/server';
import { Message, InitializeRequest, type InitializeParams } from 'vscode-languageserver-protocol';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { name as packageName } from '../package.json';

// see: https://github.com/TypeFox/monaco-languageclient/blob/main/packages/examples/src/common/node/server-commons.ts

let server: ReturnType<typeof createServerProcess>;

const createServer = (name: string) => {
  if (server) return server;
  const { url } = import.meta;
  const path = fileURLToPath(url).split(packageName)[0];
  const script = join(path, "svelte-language-server", "bin", "server.js");
  return (server = createServerProcess(name, 'node', [script, "--stdio"]));
}

const decoder = new TextDecoder();

export const start = (port: number, log = false) => {
  const name = "SvelteLS";
  process.stdin.setRawMode(true);

  const reader = new StreamMessageReader(process.stdin, {
    contentDecoder: {
      name: "dummy",
      decode: (chunk) => {
        console.log("decode reader", decoder.decode(chunk));
        return Promise.resolve(chunk);
      }
    }
  });
  const writer = new StreamMessageWriter(process.stdout, {
    contentEncoder: {
      name: "dummy",
      encode: (chunk) => {
        console.log("encode writer", decoder.decode(chunk));
        return Promise.resolve(chunk);
      }
    }
  });

  const processConnection = createConnection(reader, writer, () => {
    console.log("dispose!");
    reader.dispose();
    writer.dispose();
  });

  processConnection.forward({
    reader: reader,
    writer: writer,
    forward(to, map) {
      console.log("forward", to, map);
    },
    onClose() {
      console.log("onClose");
      return {
        dispose() {
          console.log("dispose");
        }
      }
    },
    dispose() {
      console.log("dispose");
    }
  })


  const serverConnection = createServer(name);

  if (!serverConnection)
    throw new Error('Failed to spawn Svelte Language Server');

  // forward(processConnection, serverConnection, message => {
  //   if (Message.isRequest(message)) {
  //     if (message.method === InitializeRequest.type.method) {
  //       const initializeParams = message.params as InitializeParams;
  //       initializeParams.processId = process.pid;
  //     }

  //     if (log) {
  //       console.log(`${name} Server received: ${message.method}`);
  //       console.log(message);
  //     }
  //   }

  //   if (Message.isResponse(message) && log) {
  //     console.log(`${name} Server sent:`);
  //     console.log(message);
  //   }

  //   if (Message.isNotification(message) && log) {
  //     console.log(`${name} Server notification:`);
  //     console.log(message);
  //   }

  //   console.log({ message });

  //   return message;
  // });

  console.log("READY");
}