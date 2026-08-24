// Monorepo wiring: @finance/contracts is consumed as TypeScript source (its
// package "exports" point at src/index.ts), so Metro must watch the workspace
// root and resolve the hoisted root node_modules as well as the app's own.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
