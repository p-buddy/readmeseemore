import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export const testPattern = "src/**/*.{test,spec}.{js,ts}";

/** @type {import('vite-plugin-dts').PluginOptions} */
export const dtsOptions = { exclude: testPattern };

export const generateSrcTypeDeclarationsPlugin = () => dts(dtsOptions);

/**
 * Extracts all package dependencies and peer dependencies as an array of strings
 * @param {object} pkg - The package.json object
 * @param {Record<string,string>} [pkg.dependencies] - Dependencies object from package.json
 * @param {Record<string,string>} [pkg.peerDependencies] - Peer dependencies object from package.json
 * @returns {string[]} Array of dependency package names
 */
export const externalizePackageDependencies = ({ dependencies, peerDependencies }) => [
  ...(dependencies ? Object.keys(dependencies) : []),
  ...(peerDependencies ? Object.keys(peerDependencies) : []),
];

export const organization = "readme-see-more";

export const testAsDocumentationReporter = `@${organization}/tests-as-documentation/Reporter`;

export const testConfig = {
  include: [testPattern],
  reporters: ["verbose", testAsDocumentationReporter],
}

export const baseConfig = (__dirname, name) => ({
  build: {
    lib: {
      name,
      fileName: 'index',
      entry: resolve(__dirname, 'src/index.ts'),
    },
  },
  test: testConfig,
  plugins: [generateSrcTypeDeclarationsPlugin()],
});