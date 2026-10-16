// Self-check for the "badge agent" attribution feature in store.mjs:
// cleanAgent + lastAgent set by saveBlueprint / completeTask / syncTasksFromMarkdown.
// Run: node src/lib/mcp/agent-attribution.test.mjs
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate from the real ~/.rancang: point RANCANG_HOME at a throwaway folder.
// store.mjs reads process.env.RANCANG_HOME on every call, so setting it before
// any store function runs is enough.
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "rancang-agent-test-"));
process.env.RANCANG_HOME = tempHome;

const store = await import("./store.mjs");

try {
  // 1) cleanAgent: strips control chars, trims, caps at 64 chars, undefined when empty.
  {
    assert.strictEqual(store.cleanAgent("Claude Code 2.4.0"), "Claude Code 2.4.0", "normal agent unchanged");
    assert.strictEqual(store.cleanAgent("A".repeat(80)), "A".repeat(64), "agent capped at 64 chars");
    assert.strictEqual(store.cleanAgent("A\u0000B\nC\u001fD\u007fE"), "ABCDE", "C0/C1/DEL control chars stripped");
    assert.strictEqual(store.cleanAgent("\t   \n"), undefined, "whitespace-only becomes undefined");
    assert.strictEqual(store.cleanAgent(undefined), undefined, "undefined stays undefined");
  }

  // 2) saveBlueprint(..., agent) persists lastAgent; listBlueprints maps it to agent.
  {
    const record = store.saveBlueprint({ docs: { prd: "x" }, agent: "A" });
    assert.strictEqual(record.lastAgent, "A", "saveBlueprint stores lastAgent on record");
    const listed = store.listBlueprints().find((b) => b.id === record.id);
    assert.strictEqual(listed.agent, "A", "listBlueprints exposes lastAgent as agent");
  }

  // 3) completeTask(..., agent) sets lastAgent on the stored blueprint.
  {
    const record = store.saveBlueprint({ docs: { tasks: "- [ ] T001 do thing" }, agent: "C" });
    const out = store.completeTask(record.id, "T001", true, "D");
    assert.deepStrictEqual(out.tasks.map((t) => t.done), [true], "task ticked off");
    assert.strictEqual(store.readBlueprint(record.id).lastAgent, "D", "completeTask sets lastAgent");
    const listed = store.listBlueprints().find((b) => b.id === record.id);
    assert.strictEqual(listed.agent, "D", "listBlueprints reflects completeTask agent");
  }

  // 4) syncTasksFromMarkdown(id, md, agent) sets lastAgent.
  {
    const record = store.saveBlueprint({ docs: { prd: "x" }, agent: "C" });
    store.syncTasksFromMarkdown(record.id, "- [ ] T002 next thing", "B");
    assert.strictEqual(store.readBlueprint(record.id).lastAgent, "B", "syncTasksFromMarkdown sets lastAgent");
    const listed = store.listBlueprints().find((b) => b.id === record.id);
    assert.strictEqual(listed.agent, "B", "listBlueprints reflects sync agent");
  }

  // 5) Sanitization: control chars in agent args are stored clean.
  {
    const record = store.saveBlueprint({ docs: { tasks: "- [ ] T003 thing" }, agent: "Seed" });
    store.completeTask(record.id, "T003", true, "E\u0000\nF");
    assert.strictEqual(store.readBlueprint(record.id).lastAgent, "EF", "completeTask stores cleaned agent");
    store.syncTasksFromMarkdown(record.id, "- [ ] T004 thing", "G\u007fH");
    assert.strictEqual(store.readBlueprint(record.id).lastAgent, "GH", "syncTasksFromMarkdown stores cleaned agent");
  }

  // 6) Update without agent must NOT null out an existing lastAgent.
  {
    const record = store.saveBlueprint({ docs: { prd: "x" }, agent: "KeepMe" });
    store.saveBlueprint({ id: record.id, docs: { spec: "y" } });
    assert.strictEqual(
      store.readBlueprint(record.id).lastAgent,
      "KeepMe",
      "no-agent update preserves existing lastAgent"
    );
  }

  console.log("PASS: agent attribution (cleanAgent + lastAgent)");
} finally {
  fs.rmSync(tempHome, { recursive: true, force: true });
}