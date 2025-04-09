import { type MessageConnection, NotificationType } from 'vscode-jsonrpc';
import { listen } from 'vscode-ws-jsonrpc';
import { WebSocket } from "ws";

(async () => {
  const warningTimer = setTimeout(() => {
    console.log('Has not resolved within 5 seconds');
  }, 5000);
  const timer = setTimeout(() => { }, 999999);
  await new Promise<void>(resolve => {
    const webSocket = new WebSocket('ws://localhost:6000');
    listen({
      webSocket,
      onConnection: (connection: MessageConnection) => {
        const notification = new NotificationType<string>('testNotification');
        connection.listen();
        connection.sendNotification(notification, 'Hello World');
        connection.onRequest((params) => {
          console.log(params);
          resolve();
        })
        connection.onNotification((params) => {
          console.log(params);
          resolve();
        })
      }
    });
  })
  clearTimeout(timer);
  clearTimeout(warningTimer);
  console.log("done");
})()

