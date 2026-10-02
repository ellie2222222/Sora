// Runs the compiled test of every test/*.test.ts that still exists. Globbing dist/test instead
// would keep running a deleted or renamed test, because tsc never removes its old output.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const compiled = readdirSync(join(serverRoot, 'test'))
  .filter((name) => name.endsWith('.test.ts'))
  .sort()
  .map((name) => join('dist', 'test', name.replace(/\.ts$/, '.js')));

const result = spawnSync(process.execPath, ['--import', './dist/test/setup.js', '--test', ...compiled], {
  cwd: serverRoot,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
