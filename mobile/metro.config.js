// Monorepo wiring: @sora/contracts is consumed as TypeScript source (its
// package "exports" point at src/index.ts), so Metro must watch the workspace
// root and resolve the hoisted root node_modules as well as the app's own.
const path = require('path');
const dns = require('dns');
const { getDefaultConfig } = require('expo/metro-config');

// `--localhost` binds Metro to "localhost", which Node resolves to ::1 first on Windows, while
// `adb reverse` only reaches 127.0.0.1.
dns.setDefaultResultOrder('ipv4first');
const { withNativeWind } = require('nativewind/metro');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve and bundle .wasm files (required by expo-sqlite on web)
config.resolver.assetExts.push('wasm');

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  '@': path.resolve(projectRoot, 'src'),
  '@sora/contracts': path.resolve(workspaceRoot, 'packages/contracts'),
};
config.resolver.unstable_enablePackageExports = true;
// Gradle builds each native library in place (node_modules/<pkg>/android/build, .cxx): tens of
// thousands of files that Metro would otherwise index and watch through the workspace root.
// The app bundles nothing from server/ or webpage/, and the API's `tsc --watch` rewrites server/dist on
// every save, which Metro would otherwise re-index through the watched root.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  /[\\/]android[\\/](build|\.cxx|\.gradle)[\\/].*/,
  /[\\/]android[\\/]app[\\/](build|\.cxx)[\\/].*/,
  ...['server', 'webpage'].map((dir) => new RegExp(`^${escapeRegExp(path.join(workspaceRoot, dir))}[\\\\/].*`)),
];

// country-flag-icons nests a package.json in string/3x2 whose "exports" lists only ".", so Metro warns on each
// single-flag import the root package does export. Resolve those files directly; the barrel would bundle every flag.
const FLAG_IMPORT = /^country-flag-icons\/string\/3x2\/([A-Z-]+)$/;
const flagDir = path.join(path.dirname(require.resolve('country-flag-icons/package.json')), 'string', '3x2');
const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const flag = FLAG_IMPORT.exec(moduleName);
  if (flag) return { type: 'sourceFile', filePath: path.join(flagDir, `${flag[1]}.js`) };
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

// Windows caps a process at 8,192 open files, and Metro opens every module's cache entry at once, so a
// cold bundle can cross it (EMFILE) and crash the server. Queue the store's reads and writes.
const MAX_OPEN_CACHE_FILES = 512;
function withOpenFileLimit(store) {
  let open = 0;
  const waiting = [];
  const run = async (task) => {
    // A finishing task hands its slot straight to the next waiter, so `open` never passes the limit.
    if (open < MAX_OPEN_CACHE_FILES) open++;
    else await new Promise((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else open--;
    }
  };
  return {
    name: store.name ?? store.constructor.name,
    get: (key) => run(() => store.get(key)),
    set: (key, value) => run(() => store.set(key, value)),
    clear: () => store.clear(),
  };
}
if (Array.isArray(config.cacheStores)) {
  config.cacheStores = config.cacheStores.map(withOpenFileLimit);
}

module.exports = withNativeWind(config, { input: './global.css' })

