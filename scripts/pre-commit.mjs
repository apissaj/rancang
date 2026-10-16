#!/usr/bin/env node
// Pre-commit hook: eslint src (max-warnings 0) → npm test → vitest run.
// Runs sequentially, stops at first failure, forwards exit code.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const rootDir = import.meta.dirname ?? process.cwd();
const repoRoot = join(rootDir, "..");
const fromRoot = (...parts) => join(repoRoot, ...parts);

const eslintBin = fromRoot("node_modules", "eslint", "bin", "eslint.js");
const steps = [
  {
    name: "eslint src --max-warnings 0",
    cmd: process.execPath,
    args: [eslintBin, "src", "--max-warnings", "0"],
    bin: eslintBin,
  },
  {
    name: "node scripts/run-tests.mjs",
    cmd: process.execPath,
    args: [fromRoot("scripts", "run-tests.mjs")],
    bin: process.execPath,
  },
  {
    name: "vitest run (test:unit)",
    cmd: process.execPath,
    args: [fromRoot("node_modules", "vitest", "vitest.mjs"), "run"],
    bin: process.execPath,
  },
];

for (const step of steps) {
  if (!existsSync(step.bin)) {
    console.error(`PRE-COMMIT [FAIL] ${step.name} — tidak ditemukan: ${step.bin}`);
    process.exit(1);
  }
  console.log(`PRE-COMMIT [RUN] ${step.name}`);
  const res = spawnSync(step.cmd, step.args, { cwd: repoRoot, stdio: "inherit", shell: false });
  if (res.error) {
    console.error(`PRE-COMMIT [FAIL] ${step.name} — ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`PRE-COMMIT [FAIL] ${step.name} (exit ${res.status})`);
    process.exit(res.status ?? 1);
  }
  console.log(`PRE-COMMIT [PASS] ${step.name}`);
}

console.log("PRE-COMMIT [OK] semua step lulus.");