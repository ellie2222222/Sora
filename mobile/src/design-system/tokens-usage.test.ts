import { strict as assert } from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { radius } from './radius.ts';
import { spacing } from './spacing.ts';
import { fontSize } from './typography.ts';

/**
 * MB-06 as a gate rather than prose: every static design value in `mobile/src` comes from a theme
 * token. Each rule reads source text line by line, so it catches the honest regression, not an
 * obfuscated one; DESIGN_GUIDELINES "Design tokens" lists what may stay literal.
 */

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

/** Reviewed exceptions: a literal here is deliberate, and the reason says why. */
const ALLOWLIST: readonly { file: string; line: RegExp; reason: string }[] = [
  { file: 'components/ThemeToggle.tsx', line: /opacity: 1 - slideProgress\.value/, reason: 'animation value' },
];

interface SourceLine {
  file: string;
  number: number;
  text: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'design-system' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC).map((path) => ({
  file: relative(SRC, path).split(sep).join('/'),
  source: readFileSync(path, 'utf8'),
}));

const LINES: SourceLine[] = FILES.flatMap(({ file, source }) =>
  source.split(/\r?\n/).map((text, index) => ({ file, number: index + 1, text })),
);

function isComment(text: string): boolean {
  return /^\s*(\/\/|\/?\*)/.test(text);
}

function isAllowed({ file, text }: SourceLine): boolean {
  return ALLOWLIST.some((entry) => entry.file === file && entry.line.test(text));
}

function report(hits: readonly SourceLine[]): string {
  return hits.map(({ file, number, text }) => `  ${file}:${number}  ${text.trim()}`).join('\n');
}

function violations(match: (text: string) => boolean): SourceLine[] {
  return LINES.filter((line) => !isComment(line.text) && !isAllowed(line) && match(line.text.replace(/\/\/.*$/, '')));
}

function hasLiteralBorderWidth(text: string): boolean {
  return [...text.matchAll(/\bborder\w*Width\s*:\s*(-?\d*\.?\d+)\b/g)].some((match) => Number(match[1]) !== 0);
}

function hasColourLiteral(text: string): boolean {
  return (
    /(['"`])#[0-9a-fA-F]{3,8}\1|\brgba?\(|\bhsla?\(/.test(text) ||
    /\b(color|Color|backgroundColor|tintColor|fill|stroke)\s*[:=]\s*\{?\s*['"](white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)['"]/.test(text)
  );
}

const STYLE_KEY =
  /\b(padding\w*|margin\w*|gap|rowGap|columnGap|fontSize|lineHeight|letterSpacing|border\w*Radius|border\w*Width|width|height|minWidth|maxWidth|minHeight|maxHeight|top|left|right|bottom|opacity|shadow\w+|elevation|strokeWidth)\s*:\s*([^,}]+)/g;
const NUMBER = /(?<![\w.$])-?\d*\.?\d+(?![\w.])/g;

/**
 * A non-zero number standing as its own operand in a style value. Allowed: 0, the `1` fallback of
 * an opacity ternary, a multiplier/divisor (a proportion), anything inside a call or index.
 */
function hasLiteralStyleValue(text: string): boolean {
  const code = text.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "''");
  for (const [, key, rawValue] of code.matchAll(STYLE_KEY)) {
    const value = rawValue!.split(/[([]/)[0]!;
    for (const found of value.matchAll(NUMBER)) {
      const literal = Number(found[0]);
      if (literal === 0) continue;
      if (key === 'opacity' && literal === 1) continue;
      const before = value.slice(0, found.index).trimEnd();
      const after = value.slice(found.index! + found[0].length).trimStart();
      if (/[*/]$/.test(before) || /^[*/]/.test(after)) continue;
      return true;
    }
  }
  return false;
}

const TAILWIND_NUMERIC =
  /^-?(p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|w|h|size|min-w|min-h|max-w|max-h|text|rounded(-[trbl]{1,2})?|opacity|border(-[trblxy])?|top|left|right|bottom|inset(-[xy])?|leading|tracking)-\d+(\.\d+)?$/;
const TAILWIND_DEFAULT_VALUE = /^(border(-[trblxy])?|rounded(-[trbl]{1,2})?|shadow(-\w+)?)$/;
const TAILWIND_PALETTE = /^(bg|text|border|ring|divide|fill|stroke)-(white|black|[a-z]+-\d{2,3})$/;

function classNames(text: string): string[] {
  return [...text.matchAll(/className=(?:"([^"]*)"|\{\s*['"`]([^'"`]*)['"`]\s*\})/g)].flatMap((match) =>
    (match[1] ?? match[2] ?? '').split(/\s+/).filter(Boolean),
  );
}

function hasForbiddenClass(text: string): boolean {
  return classNames(text).some(
    (name) => name.includes('-[') || TAILWIND_NUMERIC.test(name) || TAILWIND_DEFAULT_VALUE.test(name) || TAILWIND_PALETTE.test(name),
  );
}

describe('the token rules themselves', () => {
  it('flag a literal and pass the token form', () => {
    assert.equal(hasLiteralBorderWidth('borderWidth: 2,'), true);
    assert.equal(hasLiteralBorderWidth('borderLeftWidth: 1.5 }'), true);
    assert.equal(hasLiteralBorderWidth('borderWidth: 0,'), false);
    assert.equal(hasLiteralBorderWidth('borderWidth: theme.borderWidth.thin,'), false);

    assert.equal(hasColourLiteral("color: '#FF0000',"), true);
    assert.equal(hasColourLiteral("backgroundColor: 'white',"), true);
    assert.equal(hasColourLiteral('color: theme.colors.text,'), false);

    assert.equal(hasLiteralStyleValue('padding: 8,'), true);
    assert.equal(hasLiteralStyleValue('borderRadius: theme.radius.md - 3,'), true);
    assert.equal(hasLiteralStyleValue('opacity: pressed ? theme.opacity.pressed : 1,'), false);
    assert.equal(hasLiteralStyleValue('width: size * 0.5,'), false);
    assert.equal(hasLiteralStyleValue("width: '22%',"), false);
    assert.equal(hasLiteralStyleValue('height: Math.max(40, size),'), false);

    assert.equal(hasForbiddenClass('className="p-4 flex-1"'), true);
    assert.equal(hasForbiddenClass('className="border rounded-md"'), true);
    assert.equal(hasForbiddenClass('className="h-[48px]"'), true);
    assert.equal(hasForbiddenClass('className="bg-red-500"'), true);
    assert.equal(hasForbiddenClass('className="flex-1 py-sm rounded-lg items-center"'), false);
  });
});

describe('design tokens in mobile/src (MB-06)', () => {
  it('scans a real tree', () => {
    assert.ok(FILES.length > 100, `only ${FILES.length} files found under ${SRC}`);
  });

  it('sets no border width as a literal', () => {
    const hits = violations(hasLiteralBorderWidth);
    assert.deepEqual(hits, [], `use theme.borderWidth.* (or StyleSheet.hairlineWidth):\n${report(hits)}`);
  });

  it('writes no colour literal', () => {
    const hits = violations(hasColourLiteral);
    assert.deepEqual(hits, [], `use theme.colors.*:\n${report(hits)}`);
  });

  it('gives no style property a literal number', () => {
    const hits = violations(hasLiteralStyleValue);
    assert.deepEqual(hits, [], `use a theme token, derive from one, or add a reviewed ALLOWLIST entry:\n${report(hits)}`);
  });

  it('passes no literal number to a visual prop', () => {
    const hits = violations((text) =>
      [...text.matchAll(/\b(size|strokeWidth|radius|borderRadius|hitSlop|width|height)=\{\s*(-?\d*\.?\d+)\s*\}/g)].some(
        (match) => Number(match[2]) !== 0,
      ),
    );
    assert.deepEqual(hits, [], `use theme.iconSize / iconStroke / radius / sizes:\n${report(hits)}`);
  });

  it('uses only token-named NativeWind classes', () => {
    const hits = violations(hasForbiddenClass);
    assert.deepEqual(hits, [], `no arbitrary (-[…]), numeric-scale, default border/rounded/shadow or palette classes:\n${report(hits)}`);
  });

  it('never hands a Pressable a function style (CLAUDE.md Part 7, rule 15)', () => {
    const hits: string[] = [];
    for (const { file, source } of FILES) {
      for (const match of source.matchAll(/<(Pressable|TouchableOpacity|AnimatedPressable)\b/g)) {
        let depth = 0;
        let end = match.index;
        for (; end < source.length; end++) {
          const char = source[end];
          if (char === '{') depth++;
          else if (char === '}') depth--;
          else if (char === '>' && depth === 0) break;
        }
        if (/\bstyle=\{\s*(\(|\w+\s*=>|function)/.test(source.slice(match.index, end))) {
          hits.push(`  ${file}:${source.slice(0, match.index).split('\n').length}`);
        }
      }
    }
    assert.deepEqual(hits, [], `track pressed state and pass a plain style:\n${hits.join('\n')}`);
  });
});

describe('tailwind.config.js mirrors the design tokens', () => {
  const config = createRequire(import.meta.url)('../../tailwind.config.js') as {
    theme: { extend: Record<'spacing' | 'borderRadius' | 'fontSize', Record<string, string>> };
  };
  const mirrors = [
    ['spacing', spacing],
    ['borderRadius', radius],
    ['fontSize', fontSize],
  ] as const;

  for (const [scale, tokens] of mirrors) {
    it(`${scale} has the same keys and values`, () => {
      const expected = Object.fromEntries(Object.entries(tokens).map(([key, value]) => [key, `${value}px`]));
      assert.deepEqual(config.theme.extend[scale], expected);
    });
  }
});
