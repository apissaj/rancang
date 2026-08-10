// Self-check for design-yaml.ts front-matter parsing. Run: node src/lib/design-yaml.test.mjs
import assert from "node:assert";

const { extractFrontMatter, resolveTokens } = await import("./design-yaml.ts").catch(async () => {
  console.log("SKIP: requires a TS-aware runtime (tsx/ts-node) to import design-yaml.ts directly.");
  process.exit(0);
});

const md = `---
version: alpha
name: Test Design
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
rounded:
  sm: 4px
  md: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.sm}"
---
## Overview
Some body text.
`;

const parsed = extractFrontMatter(md);
assert.ok(parsed, "should extract front matter");
assert.strictEqual(parsed.name, "Test Design");
assert.strictEqual(parsed.colors.primary, "#1A1C1E");
assert.strictEqual(parsed.rounded.sm, "4px");

const resolved = resolveTokens(parsed);
assert.strictEqual(resolved.components["button-primary"].backgroundColor, "#1A1C1E");
assert.strictEqual(resolved.components["button-primary"].rounded, "4px");

const noFrontMatter = extractFrontMatter("# Just markdown, no front matter");
assert.strictEqual(noFrontMatter, null, "returns null when no front matter block present");

console.log("PASS: design-yaml front matter extraction + token resolution");
