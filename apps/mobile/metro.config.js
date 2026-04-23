// Metro config tuned for an npm-workspaces monorepo.
//
// We extend (not replace) Expo's defaults: add the workspace root to
// `watchFolders` and add the root `node_modules` to the resolver's lookup
// path. Keeping `disableHierarchicalLookup = false` lets Metro traverse
// upward for dependencies that npm hoisted to the root, while still
// respecting app-local overrides. Without these, imports of
// `@tmjconnect/shared` (symlinked workspace) fail to resolve.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders ?? []),
  workspaceRoot,
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
