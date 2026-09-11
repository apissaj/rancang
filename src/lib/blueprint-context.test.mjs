// Run: node --test src/lib/blueprint-context.test.mjs
//
// These helpers decide what the LLM sees when the user chats about (or asks to
// rewrite) a blueprint. The failure modes worth guarding are silent: a doc that
// drops out of the context, or the doc being rewritten also being handed over as
// read-only context (the model then "revises" text it was told not to touch).
import test from "node:test";
import assert from "node:assert/strict";

import { buildBlueprintContext, docLabel, DOC_ORDER } from "./blueprint-context.ts";

const DOCS = {
  prd: "# PRD\n\nGoals: ship fast.",
  spec: "# SPEC\n\nP1: create link.",
  plan: "# PLAN\n\nStack: Workers + D1.",
  tasks: "# TASKS\n\n- [ ] T001 Migrate.",
};

test("renders every document, in DOC_ORDER, labelled", () => {
  const ctx = buildBlueprintContext(DOCS);
  for (const name of DOC_ORDER) {
    assert.ok(ctx.includes(`=== ${docLabel(name)} (${name}.md) ===`), `missing heading for ${name}`);
    assert.ok(ctx.includes(DOCS[name]), `missing body for ${name}`);
  }
  const positions = DOC_ORDER.map((n) => ctx.indexOf(`${n}.md)`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "documents out of order");
});

test("blank and missing documents are skipped, not rendered as empty sections", () => {
  const ctx = buildBlueprintContext({ prd: DOCS.prd, spec: "   \n  ", plan: "", tasks: DOCS.tasks });
  assert.ok(ctx.includes("prd.md"));
  assert.ok(ctx.includes("tasks.md"));
  assert.ok(!ctx.includes("spec.md"), "whitespace-only doc should be skipped");
  assert.ok(!ctx.includes("plan.md"), "empty doc should be skipped");
});

test("exclude drops the target doc from read-only context but keeps the others", () => {
  const ctx = buildBlueprintContext(DOCS, { exclude: "spec" });
  assert.ok(!ctx.includes(DOCS.spec), "excluded doc must not leak as context");
  assert.ok(!ctx.includes("spec.md"));
  assert.ok(ctx.includes(DOCS.prd));
  assert.ok(ctx.includes(DOCS.plan));
  assert.ok(ctx.includes(DOCS.tasks));
});

test("exclude of a doc that has no content changes nothing", () => {
  const withExclude = buildBlueprintContext(DOCS, { exclude: "nope" });
  assert.equal(withExclude, buildBlueprintContext(DOCS));
});

test("empty blueprint yields an empty string (caller validates, not us)", () => {
  assert.equal(buildBlueprintContext({}), "");
  assert.equal(buildBlueprintContext({ prd: "", spec: "  " }), "");
});

test("docLabel falls back to uppercase for unknown names", () => {
  assert.equal(docLabel("prd"), "PRD");
  assert.equal(docLabel("tasks"), "TASKS");
  assert.equal(docLabel("custom"), "CUSTOM");
});
