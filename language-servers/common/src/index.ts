import { StreamMessageReader, StreamMessageWriter } from './jsonrpc';
import { createConnection, createServerProcess, forward } from 'vscode-ws-jsonrpc/server';
import { Message, InitializeRequest, type InitializeParams } from 'vscode-languageserver-protocol';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from '@commander-js/extra-typings';
import { announce, ready, starting } from '@readmeseemore/language-servers-interop';
import { name as pkgName } from '../package.json';

type Args = { identifier: string, script: string }

const create = async ({ identifier, script }: Args, log = false) => {
  process.stdin.setRawMode(true);

  const reader = new StreamMessageReader(process.stdin, "utf-8");
  const writer = new StreamMessageWriter(process.stdout, "utf-8");

  const processConnection = createConnection(reader, writer, () => {
    reader.dispose();
    writer.dispose();
  });

  const pathToScript = join(
    fileURLToPath(import.meta.url).split(pkgName)[0], script
  );

  const serverConnection = createServerProcess(
    identifier,
    'node',
    [pathToScript, "--stdio"]
  );

  if (!serverConnection)
    throw new Error(`Failed to spawn ${identifier} Language Server`);

  forward(processConnection, serverConnection, message => {
    if (Message.isRequest(message)) {
      if (message.method === InitializeRequest.type.method) {
        const initializeParams = message.params as InitializeParams;
        initializeParams.processId = process.pid;
      }

      if (log) announce(identifier, `received ${message.method}`, message);
    }

    if (Message.isResponse(message) && log)
      announce(identifier, "sent", message);

    if (Message.isNotification(message) && log)
      announce(identifier, "notification", message);

    return message;
  });

  ready();
}

type PackageJSON = { version: string };

export const cli = (args: Args & { pkg: PackageJSON }) => {
  starting();

  const { pkg: { version }, identifier } = args;
  const program = new Command()
    .version(version)
    .option('-d, --debug')
    .option('-v, --verbose', 'verbose output')
    .parse();

  const options = program.opts();

  const flags = Object.entries(options).map(([key, value]) => `${key}: ${value}`).join(', ');
  console.log(`Starting ${identifier} language server (v${version}, flags: ${flags})`);

  create(args, options.verbose || false);
}