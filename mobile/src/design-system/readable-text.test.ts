import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { fontSize } from './typography.ts';

/**
 * DESIGN_GUIDELINES "Type size and tone" as a gate: muted text is never smaller than `sm`, faint text
 * never smaller than `md`. Reads each <Text>/<Money>/<Animated.Text> opening tag as source text; a
 * size or colour held in a variable is not followed, so this catches the honest regression only.
 */

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));
type SizeKey = keyof typeof fontSize;

const FLOOR: Record<'muted' | 'faint', SizeKey> = { muted: 'sm', faint: 'md' };
const TONE_OF_COLOR: Record<string, 'muted' | 'faint'> = { textMuted: 'muted', textFaint: 'faint' };

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });
}

/** `VARIANT_SIZE` and the default variant, read from Text.tsx so a remapped variant moves the check with it. */
function textVariants(): { sizes: Record<string, SizeKey>; fallback: string } {
  const source = readFileSync(join(SRC, 'components/Text.tsx'), 'utf8');
  const body = source.match(/const VARIANT_SIZE[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  const sizes = Object.fromEntries([...body.matchAll(/(\w+):\s*'(\w+)'/g)].map((m) => [m[1], m[2] as SizeKey]));
  const fallback = source.match(/variant = '(\w+)'/)?.[1] ?? 'body';
  return { sizes, fallback };
}

/** The opening tag starting at `start`, ending at the first `>` outside any `{…}` expression. */
function openingTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const c = source[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

/** Every tone the tag can render in: each literal a `tone` expression can yield, plus a muted/faint style colour. */
function tonesOf(tag: string): Set<string> {
  const tones = new Set<string>();
  const literal = tag.match(/\btone="(\w+)"/)?.[1];
  if (literal) tones.add(literal);
  const expression = tag.match(/\btone=\{([^}]*)\}/)?.[1];
  if (expression) for (const m of expression.matchAll(/'(\w+)'|"(\w+)"/g)) tones.add(m[1] ?? m[2]!);
  const color = tag.match(/(?<![\w-])color:\s*([^,}]*)/)?.[1] ?? '';
  for (const m of color.matchAll(/theme\.colors\.(\w+)/g)) {
    const tone = TONE_OF_COLOR[m[1]!];
    if (tone) tones.add(tone);
  }
  return tones;
}

interface Hit {
  where: string;
  problem: string;
}

function scan(): Hit[] {
  const { sizes, fallback } = textVariants();
  const hits: Hit[] = [];
  for (const path of sourceFiles(SRC)) {
    const file = relative(SRC, path).split(sep).join('/');
    const source = readFileSync(path, 'utf8');
    for (const match of source.matchAll(/<(Text|Money|Animated\.Text)\b/g)) {
      const tag = openingTag(source, match.index);
      const where = `${file}:${source.slice(0, match.index).split('\n').length}`;
      const override = tag.match(/fontSize:\s*theme\.fontSize\.(\w+)/)?.[1] as SizeKey | undefined;
      const variant = tag.match(/\bvariant="(\w+)"/)?.[1] ?? fallback;
      const size = override ?? sizes[variant];
      const tones = tonesOf(tag);

      if (/allowFontScaling=\{false\}|maxFontSizeMultiplier/.test(tag)) hits.push({ where, problem: 'caps system font scaling' });
      for (const tone of ['muted', 'faint'] as const) {
        if (!tones.has(tone)) continue;
        if (size !== undefined && fontSize[size] < fontSize[FLOOR[tone]]) {
          hits.push({ where, problem: `${tone} text at ${size} (${fontSize[size]}), below ${FLOOR[tone]}` });
        }
        if (/\bopacity:/.test(tag)) hits.push({ where, problem: `opacity on ${tone} text` });
        if (/adjustsFontSizeToFit|minimumFontScale/.test(tag)) hits.push({ where, problem: `${tone} text allowed to shrink` });
      }
    }
  }
  return hits;
}

describe('readable text', () => {
  it('reads the variant map it checks against', () => {
    const { sizes, fallback } = textVariants();
    assert.ok(sizes[fallback], `no size for the default variant "${fallback}" in Text.tsx`);
    assert.ok(Object.values(sizes).every((size) => size in fontSize), 'VARIANT_SIZE names a size that is not a fontSize token');
  });

  it('keeps muted text at sm or larger and faint text at md or larger, never shrunk or faded further', () => {
    const hits = scan();
    assert.deepEqual(hits, [], `Below the "Type size and tone" floors:\n${hits.map((h) => `  ${h.where}  ${h.problem}`).join('\n')}`);
  });
});
