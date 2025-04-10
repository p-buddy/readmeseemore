import type { Server } from 'node:http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { type IWebSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { createConnection, createServerProcess, forward } from 'vscode-ws-jsonrpc/server';
import { Message, InitializeRequest, type InitializeParams } from 'vscode-languageserver-protocol';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// see: https://github.com/TypeFox/monaco-languageclient/blob/main/packages/examples/src/common/node/server-commons.ts

let server: ReturnType<typeof createServerProcess>;

const createServer = (name: string) => {
  if (server) return server;
  const relative = "@readmeseemore/svelte-language-server/dist/index.js"
  const { url } = import.meta;
  const path = fileURLToPath(url).replace(relative, "");
  const script = join(path, "svelte-language-server", "bin", "server.js");
  return (server = createServerProcess(name, 'node', [script]));
}

export const start = (port: number, log = false) => {
  const name = "SvelteLS";
  const app = express();
  const server: Server = app.listen(port);
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) =>
    wss.handleUpgrade(request, socket, head, webSocket => {
      const socket: IWebSocket = {
        send: content => webSocket.send(content, error => {
          if (log && !error) console.log("sent", content);
          if (error) throw error;
        }),
        onMessage: cb => webSocket.on('message', (data) => {
          cb(data);
        }),
        onError: cb => webSocket.on('error', cb),
        onClose: cb => webSocket.on('close', cb),
        dispose: () => webSocket.close()
      };

      const launch = () => {
        const reader = new WebSocketMessageReader(socket);
        const writer = new WebSocketMessageWriter(socket);
        const socketConnection = createConnection(reader, writer, () => webSocket.terminate());
        // Spawn the Svelte Language Server process (stdio mode)
        const serverConnection = createServer(name);

        if (!serverConnection) {
          const msg = 'Failed to spawn Svelte Language Server';
          console.error(msg);
          throw new Error(msg);
        }

        forward(socketConnection, serverConnection, message => {
          if (Message.isRequest(message)) {
            if (message.method === InitializeRequest.type.method) {
              const initializeParams = message.params as InitializeParams;
              initializeParams.processId = process.pid;
            }

            if (log) {
              console.log(`${name} Server received: ${message.method}`);
              console.log(message);
            }
          }

          if (Message.isResponse(message)) {
            if (log) {
              console.log(`${name} Server sent:`);
              console.log(message);
            }
          }

          if (Message.isNotification(message) && log) {
            console.log(`${name} Server notification:`);
            console.log(message);
          }

          return message;
        });
      }

      if (webSocket.readyState === webSocket.OPEN) launch()
      else webSocket.on('open', launch);
    })
  );
}