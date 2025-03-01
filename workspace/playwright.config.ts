/// <reference types="node" />
import { defineConfig } from '@playwright/test';

export default defineConfig({

  webServer: {
    command: `${process.env.SKIP_BUILD ? '' : 'npm run build && '}npm run preview`,
    port: 4173
  },

  testDir: 'e2e'
});