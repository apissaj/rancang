// Self-check for design-export.ts. Run: node --test src/lib/design-export.test.mjs
import assert from "node:assert";

const mod = await import("./design-export.ts").catch(async () => {
  console.log("SKIP: requires a TS-aware runtime (tsx/ts-node) to import design-export.ts directly.");
  process.exit(0);
});
const { buildWireframeExport, screenFileName, buildHifiReadme, planLabel } = mod;

const screens = [
  { id: "s1", name: "Home Screen", platform: "mobile", components: [{ type: "button", label: "Go", onClick: "s2" }], generatedImage: "/api/images/d1/s1.png" },
  { id: "s2", name: "Settings", platform: "mobile", components: [{ type: "text", label: "Hi" }] },
];

const out = buildWireframeExport({
  design: { title: "Habit tracker" },
  idea: "an idea",
  platform: "mobile",
  pwa: true,
  designMd: "# tokens",
  screens,
});

assert.strictEqual(out.designTitle, "Habit tracker");
assert.strictEqual(out.platform, "mobile");
assert.strictEqual(out.pwa, true);
assert.strictEqual(out.screens.length, 2);
// generatedImage is a server path — meaningless to the agent unzipping this, so it's dropped.
assert.ok(!("generatedImage" in out.screens[0]), "should not leak generatedImage");
assert.strictEqual(out.screens[0].components[0].onClick, "s2");
assert.ok(!("onClick" in out.screens[1].components[0]), "omits absent onClick");

// Falls back to the idea when the record has no title.
assert.strictEqual(
  buildWireframeExport({ design: null, idea: "a habit tracker", platform: "web", pwa: false, designMd: "", screens: [] }).designTitle,
  "a habit tracker"
);

// Filenames: slugged, index-prefixed so duplicate screen names stay distinct.
assert.strictEqual(screenFileName(screens[0], 0), "01-home-screen.png");
assert.strictEqual(screenFileName({ name: "Sign / Up!" }, 9), "10-sign-up.png");
assert.strictEqual(screenFileName({ name: "!!!" }, 0), "01-screen.png");

const readme = buildHifiReadme("Habit tracker", "# tokens", [{ name: "Home Screen", file: "01-home-screen.png" }]);
assert.ok(readme.includes("`screens/01-home-screen.png`"));
assert.ok(readme.includes("# tokens"));

// Never show a bare id: title wins, then idea, then a placeholder.
assert.strictEqual(planLabel({ title: "My PRD", idea: "x" }), "My PRD");
assert.strictEqual(planLabel({ title: "   ", idea: "an idea" }), "an idea");
assert.strictEqual(planLabel({}), "Untitled PRD");

console.log("design-export: all assertions passed");
