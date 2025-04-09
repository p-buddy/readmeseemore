#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import { version } from '../package.json';
import { start } from '.';

const program = new Command()
  .version(version)
  .option('-d, --debug')
  .argument('[port]', 'port to listen on')
  .option('-p, --port <port>', 'port to listen on', '6009')
  .option('-v, --verbose', 'verbose output')
  .parse();

const [portArg] = program.args;
const { port, verbose } = program.opts();

start(parseInt(portArg ?? port), verbose || false);
