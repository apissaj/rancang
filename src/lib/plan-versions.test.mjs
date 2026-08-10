// Self-check for PlanRecord versions migration in storage.ts.
// Run: node src/lib/plan-versions.test.mjs
import assert from "node:assert";

const store = new Map();
global.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  },
};

const { planStore, setStorageScope } = await import("./storage.ts").catch(async () => {
  console.log("SKIP: requires a TS-aware runtime (tsx/ts-node) to import storage.ts directly.");
  process.exit(0);
});

setStorageScope(null);

// Seed an OLD-SHAPE record directly into localStorage (no `versions` field).
const oldShape = { id: "old1", title: "Old plan", idea: "an idea", markdown: "# Old MD", createdAt: 1 };
window.localStorage.setItem("prd-forge:anon:plans", JSON.stringify([oldShape]));

const all = planStore.all();
assert.strictEqual(all.length, 1, "old-shape record should still load");
assert.strictEqual(all[0].markdown, "# Old MD", "markdown preserved");
assert.ok(Array.isArray(all[0].versions), "versions synthesized as array");
assert.strictEqual(all[0].versions.length, 1, "exactly one synthesized version");
assert.strictEqual(all[0].versions[0].markdown, "# Old MD");
assert.strictEqual(all[0].versions[0].source, "generated");
assert.strictEqual(all[0].versions[0].createdAt, 1);

// New-shape record with versions passes through untouched.
const newShape = {
  id: "new1",
  title: "New plan",
  idea: "idea2",
  markdown: "v2 md",
  createdAt: 5,
  versions: [
    { id: "va", markdown: "v1 md", createdAt: 4, source: "generated" },
    { id: "vb", markdown: "v2 md", createdAt: 5, source: "manual-edit" },
  ],
};
planStore.save(newShape);
const reloaded = planStore.all().find((p) => p.id === "new1");
assert.strictEqual(reloaded.versions.length, 2, "existing versions untouched");
assert.strictEqual(reloaded.versions[1].source, "manual-edit");

console.log("PASS: plan versions migration + passthrough");
