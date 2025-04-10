import { type MessageConnection, NotificationType } from 'vscode-jsonrpc';
import { listen, } from 'vscode-ws-jsonrpc';
import { WebSocket } from "ws";

/**
 * NOTE: Timers are helpful, as node will keep the process running while there `setTimeout`s running
 * (but this is not the case for unresolved promises).
 * @param ms 
 * @param cb 
 * @returns 
 */
const timer = (ms: number, cb?: () => void) => {
  const self = setTimeout(cb ?? (() => { }), ms);
  return () => clearTimeout(self);
}

// Get command line arguments
const args = process.argv.slice(2);
const notificationType = args[0] || 'testNotification';
const message = args[1] || 'Hello World';

(async () => {
  const clear = timer(999999);

  const webSocket = new WebSocket('ws://localhost:6000');
  await new Promise<void>(resolve =>
    listen({
      webSocket: webSocket as WebSocket & globalThis.WebSocket,
      onConnection: async (connection: MessageConnection) => {
        const notification = new NotificationType<string>(notificationType);
        connection.listen();
        await connection.sendNotification(notification, message);
        resolve();
      },
    })
  );
  webSocket.close();

  clear();
})()

