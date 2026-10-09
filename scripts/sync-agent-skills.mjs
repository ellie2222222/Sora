#!/usr/bin/env node
/**
 * Copies the repo's own skills from .claude/skills (Claude Code's only skill root) into
 * .agents/skills (Codex's repo skill root). Copies rather than links: a junction/symlink
 * mirror turns deleting the mirror into deleting the originals, and git on Windows checks
 * symlinks out as plain files. The vendored Front-End Checklist corpus is left out so its
 * ~390 descriptions don't crowd Codex's skill-catalog token budget.
 *
 * Never deletes: a stale file or skill in .agents/skills is reported for manual removal.
 *
 * Usage: node scripts/sync-agent-skills.mjs          # copy
 *        node scripts/sync-agent-skills.mjs --check  # exit 1 on any drift (CI)
 */

import { cpSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, '.claude/skills');
const TARGET = join(ROOT, '.agents/skills');

const SKILLS = [
  'brainstorm-features',
  'comment-audit',
  'commit-messages',
  'double-check',
  'extract-modules',
  'i18n-audit',
  'infra-audit',
  'readability-audit',
  'restructure',
  'scratch-probe',
  'skill-audit',
];

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map((entry) => join(dir, entry))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(dir, path).replaceAll('\\', '/'))
    .sort();
}

function frontmatterProblems(name) {
  const text = readFileSync(join(SOURCE, name, 'SKILL.md'), 'utf8');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const declaredName = frontmatter.match(/^name:\s*(.+?)\s*$/m)?.[1];
  const problems = [];
  if (declaredName !== name) problems.push(`${name}: frontmatter name is "${declaredName}"`);
  if (!/^description:\s*\S/m.test(frontmatter)) problems.push(`${name}: frontmatter has no description`);
  return problems;
}

function drift() {
  const problems = [];
  for (const name of SKILLS) {
    const from = join(SOURCE, name);
    const to = join(TARGET, name);
    if (!existsSync(join(from, 'SKILL.md'))) {
      problems.push(`${name}: missing from .claude/skills`);
      continue;
    }
    problems.push(...frontmatterProblems(name));
    const sourceFiles = listFiles(from);
    const targetFiles = new Set(listFiles(to));
    for (const file of sourceFiles) {
      if (!targetFiles.has(file)) problems.push(`${name}/${file}: not copied`);
      else if (!readFileSync(join(from, file)).equals(readFileSync(join(to, file)))) {
        problems.push(`${name}/${file}: differs from .claude/skills`);
      }
      targetFiles.delete(file);
    }
    for (const file of targetFiles) problems.push(`${name}/${file}: stale, not in .claude/skills`);
  }
  const extra = existsSync(TARGET)
    ? readdirSync(TARGET).filter((entry) => !SKILLS.includes(entry))
    : [];
  for (const entry of extra) problems.push(`${entry}: in .agents/skills but not in SKILLS`);
  return problems;
}

if (!process.argv.includes('--check')) {
  for (const name of SKILLS) cpSync(join(SOURCE, name), join(TARGET, name), { recursive: true });
}

const problems = drift();
if (problems.length > 0) {
  console.error(`agent skills out of sync (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('Edit .claude/skills, then run: node scripts/sync-agent-skills.mjs');
  process.exit(1);
}
console.log(`agent skills in sync: ${SKILLS.length} skills in .agents/skills`);
