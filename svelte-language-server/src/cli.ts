#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import { version } from '../package.json';
import { start } from '.';

const program = new Command()
  .version(version)
  .option('-d, --debug')
  .option('-v, --verbose', 'verbose output')
  .parse();

const { verbose } = program.opts();

console.log(`Starting Svelte Language Server (v${version})`);
start(verbose || false);
