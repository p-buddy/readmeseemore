#!/usr/bin/env node
import { cli } from '@readmeseemore/language-servers-common';
import { version } from '../package.json';

cli({
  version,
  identifier: 'typescript',
  script: 'typescript-language-server/lib/cli.mjs',
});
