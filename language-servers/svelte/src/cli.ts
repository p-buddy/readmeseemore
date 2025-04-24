#!/usr/bin/env node
import { cli } from '@readmeseemore/language-servers-common';
import { version } from '../package.json';

cli({
  version,
  identifier: 'svelte',
  script: 'svelte-language-server/bin/server.js',
});
