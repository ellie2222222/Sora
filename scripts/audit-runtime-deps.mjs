#!/usr/bin/env node
/**
 * `npm audit --omit=dev` that fails on any high or critical advisory except the ones accepted
 * below. npm audit has no per-advisory ignore, and lowering --audit-level would hide every
 * future finding to silence one.
 *
 * An accepted advisory fails the run again once its review date passes or once npm audit no
 * longer reports it, so an exemption cannot outlive the reason it was granted.
 *
 * Usage: node scripts/audit-runtime-deps.mjs
 */

import { spawnSync } from 'node:child_process';

const FAILING = new Set(['high', 'critical']);

/** Keyed by the advisory's GHSA id, as the last segment of its URL. */
const ACCEPTED = {
  'GHSA-86w9-cpqp-85rv': {
    reviewBy: '2026-11-02',
    reason:
      'node-forge <=1.4.0 has no fixed release; only @expo/cli (build tooling, not bundled into the app) depends on it',
  },
  'GHSA-vfj7-8cjw-p6xm': {
    reviewBy: '2026-11-02',
    reason:
      'braces <=3.0.3 has no fixed release; only tailwindcss 3 (nativewind\'s build-time compiler, never bundled into the app) depends on it, and npm\'s only fix is a major tailwindcss 4 upgrade',
  },
};

// A fixed command string through the shell, so Windows resolves npm.cmd.
const audit = spawnSync('npm audit --omit=dev --json', {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error('npm audit produced no JSON report:\n', audit.stderr || audit.stdout);
  process.exit(1);
}

// String entries in `via` point at another vulnerable package; objects are the advisories themselves.
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'object' && FAILING.has(via.severity)) advisories.set(via.url.split('/').pop(), via);
  }
}

const today = new Date().toISOString().slice(0, 10);
const problems = [];
for (const [id, advisory] of advisories) {
  const accepted = ACCEPTED[id];
  if (!accepted) problems.push(`${advisory.severity} ${id} in ${advisory.name} ${advisory.range}: ${advisory.title}`);
  else if (accepted.reviewBy < today) problems.push(`${id} was accepted until ${accepted.reviewBy}; review it again`);
  else console.log(`accepted ${id} in ${advisory.name} until ${accepted.reviewBy}: ${accepted.reason}`);
}
for (const id of Object.keys(ACCEPTED)) {
  if (!advisories.has(id)) problems.push(`${id} is no longer reported; remove it from ACCEPTED`);
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`no unaccepted high or critical advisories in runtime dependencies (${advisories.size} accepted)`);
