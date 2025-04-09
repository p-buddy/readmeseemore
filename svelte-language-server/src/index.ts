import { WebSocketServer } from 'ws';
import { WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import { createConnection, createServerProcess, forward } from 'vscode-ws-jsonrpc/server';


// see: https://github.com/TypeFox/monaco-languageclient/blob/main/packages/examples/src/common/node/server-commons.ts

export const start = (port: number) => {
  const wss = new WebSocketServer({ port });

  // 2. When the browser connects, spawn the Svelte LS and forward messages
  wss.on('connection', (socket) => {
    // Wrap the raw WebSocket in VSCode RPC reader/writer
    const reader = new WebSocketMessageReader(socket);
    const writer = new WebSocketMessageWriter(socket);
    const socketConnection = createConnection(reader, writer, () => socket.terminate());

    // Spawn the Svelte Language Server process (stdio mode)
    const serverConnection = createServerProcess('SvelteLS',
      'node', ['node_modules/svelte-language-server/bin/server.js', '--stdio']
    );

    if (!serverConnection)
      throw new Error('Failed to spawn Svelte Language Server');

    forward(socketConnection, serverConnection, (message) => message);
  });
}