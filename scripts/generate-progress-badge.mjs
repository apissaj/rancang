#!/usr/bin/env node
/**
 * generate-progress-badge.mjs
 *
 * Self-contained progress-badge generator for the Rancang README.
 * No npm packages, no external API calls — pure Node.js (18+) stdlib.
 *
 * What it does:
 *   1. Scans the repository for task lists written in Spec-Kit checkbox
 *      format (`- [ ] T001 ...` / `- [x] T001 ...`).
 *      Sources (in order):
 *        - docs/superpowers/plans/*.md          (repo's own implementation plans)
 *        - any checked-in tasks.md              (Rancang blueprint tasks)
 *   2. Counts done vs total across all found files.
 *   3. Regenerates public/badge-progress.svg (shields.io-flat-style badge).
 *   4. Writes it ONLY if the content actually changed, and exits 0 either way
 *      (so the workflow can simply `git diff --quiet` to decide whether to commit).
 *
 * Usage:
 *   node scripts/generate-progress-badge.mjs [repo-root]
 *
 * Output (on stdout): JSON line with counts + whether the file was written.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] || process.cwd());
const OUT = join(root, "public", "badge-progress.svg");

// ---------------------------------------------------------------------------
// 1. Find task-list files
// ---------------------------------------------------------------------------

/** Checkbox bullet: list marker, optional checkbox, task id-ish rest. */
function isCheckboxLine(line) {
  return /^\s*[-*]\s*\[\s*([xX]?)\s*\]\s+\S/.test(line);
}

function collectCheckboxes(file) {
  let done = 0;
  let total = 0;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return { file, done: 0, total: 0 };
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*[-*]\s*\[\s*([xX]?)\s*\]\s+\S/.exec(line);
    if (!m) continue;
    total += 1;
    if (m[1]) done += 1;
  }
  return { file, done, total };
}

function walk(dir, depth, out) {
  if (depth > 4) return out;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === ".next") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, depth + 1, out);
    else if (e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const sources = [];
for (const p of walk(root, 0, [])) {
  if (/[\\/]docs[\\/]superpowers[\\/]plans[\\/].*\.md$/.test(p)) sources.push(p);
  else if (p.endsWith("tasks.md")) sources.push(p);
}
sources.sort();

let done = 0;
let total = 0;
const reports = [];
for (const f of sources) {
  const r = collectCheckboxes(f);
  done += r.done;
  total += r.total;
  reports.push(r);
}

// ---------------------------------------------------------------------------
// 2. Build the badge
// ---------------------------------------------------------------------------

const pct = total > 0 ? Math.round((done / total) * 100) : 0;
const color =
  total === 0 ? "#9ca3af" : pct >= 100 ? "#22c55e" : pct >= 60 ? "#8b5cf6" : pct >= 25 ? "#f59e0b" : "#ef4444";
const label = "Rancang tasks";
const value = total > 0 ? `${done}/${total} (${pct}%)` : "no task lists";

// Rough text width (Verdana ~7px/char @11px); segment = text + 10px padding/side.
const W = (s) => Math.round(s.length * 7 + 20);
const lw = W(label);
const rw = Math.max(W(value), 40);
const width = lw + rw;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#fff" stop-opacity="0"/>
    <stop offset=".9" stop-color="#fff" stop-opacity="0"/>
    <stop offset="1" stop-color="#fff" stop-opacity=".7"/>
  </linearGradient>
  <clipPath id="r"><rect width="${width}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#333"/>
    <rect x="${lw}" width="${rw}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${Math.floor(lw / 2)}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${Math.floor(lw / 2)}" y="14">${label}</text>
    <text x="${lw + Math.floor(rw / 2)}" y="15" fill="#010101" fill-opacity=".3">${value}</text>
    <text x="${lw + Math.floor(rw / 2)}" y="14">${value}</text>
  </g>
</svg>
`;

// ---------------------------------------------------------------------------
// 3. Write only when changed
// ---------------------------------------------------------------------------

let changed = false;
if (existsSync(OUT) && readFileSync(OUT, "utf8") === svg) {
  // identical — leave on disk untouched so `git diff` stays clean
} else {
  writeFileSync(OUT, svg, "utf8");
  changed = true;
}

process.stdout.write(
  JSON.stringify({ sources: reports, done, total, percent: pct, changed, out: OUT }) + "\n"
);