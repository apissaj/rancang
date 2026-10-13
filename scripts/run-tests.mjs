// Runs every *.test.mjs under src/lib and src/lib/mcp sequentially.
// A test is a FAIL (non-zero exit) if it errors or exits non-zero.
// "SKIP" tests exit 0, so they count as skipped, not failed.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dirs = ["src/lib", "src/lib/mcp"];

const files = [];
for (const dir of dirs) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  for (const entry of readdirSync(abs)) {
    if (entry.endsWith(".test.mjs")) files.push(join(abs, entry));
  }
}
files.sort();

let failed = false;
for (const file of files) {
  const rel = relative(root, file);
  const res = spawnSync(process.execPath, [file], { encoding: "utf8", cwd: root });
  if (res.status === 0 && !res.error) {
    const skipped = /^SKIP:/m.test(res.stdout);
    console.log(`[${skipped ? "SKIP" : "PASS"}] ${rel}`);
  } else {
    failed = true;
    console.log(`[FAIL] ${rel}`);
    console.log(res.stdout ?? "");
    console.error(res.stderr ?? `(exit code ${res.status})`);
  }
}

if (failed) {
  console.error("\nOne or more tests FAILED.");
  process.exit(1);
}
console.log("\nAll tests passed.");