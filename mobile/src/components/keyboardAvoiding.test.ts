import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/** CLAUDE.md Part 7 rule 20 as a gate: edge-to-edge Android needs every KeyboardAvoidingView to pad. */

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(entry.name) ? [path] : [];
  });
}

/** Each `<KeyboardAvoidingView …>` opening tag, props included. */
function openingTags(text: string): string[] {
  return [...text.matchAll(/<KeyboardAvoidingView\b[^>]*>/g)].map((match) => match[0]);
}

describe('KeyboardAvoidingView on Android', () => {
  const uses = sourceFiles(SRC).flatMap((path) =>
    openingTags(readFileSync(path, 'utf8')).map((tag) => ({ file: relative(SRC, path).split(sep).join('/'), tag })),
  );

  it('is used somewhere, so this scan reads real source', () => {
    assert.ok(uses.length > 0);
  });

  it('pads on every platform, never only on iOS', () => {
    const offending = uses.filter(({ tag }) => !/behavior="padding"/.test(tag)).map(({ file }) => file);
    assert.deepEqual(offending, []);
  });
});
