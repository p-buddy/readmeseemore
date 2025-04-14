#!/usr/bin/env node
import { Command } from '@commander-js/extra-typings';
import { version } from '../package.json';
import { start } from '.';

const program = new Command()
  .version(version)
  .option('-d, --debug')
  .option('-v, --verbose', 'verbose output')
  .parse();

const options = program.opts();

const flags = Object.entries(options).map(([key, value]) => `${key}: ${value}`).join(', ');
console.log(`Starting Svelte Language Server (v${version}, flags: ${flags})`);

start(options.verbose || false);
