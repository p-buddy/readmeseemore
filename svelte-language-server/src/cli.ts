#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import { version } from '../package.json';
import { start } from '.';

const program = new Command()
  .version(version)
  .option('-d, --debug')
  .option('-p, --port <port>', 'port to listen on', '6009')
  .parse();

const options = program.opts();

start(parseInt(options.port));
