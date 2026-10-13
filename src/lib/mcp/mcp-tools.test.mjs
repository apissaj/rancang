// Self-check for Rancang MCP tool argument handling.
// Run: node src/lib/mcp/mcp-tools.test.mjs
import assert from "node:assert";
import { checkArgs, TOOLS } from "./tools.mjs";

const byName = (n) => TOOLS.find((t) => t.name === n).inputSchema;

// 1) blueprint_id is accepted as an alias for id.
{
  const schema = byName("rancang_next_task");
  const args = checkArgs(schema, { blueprint_id: "bpl_abc123" });
  assert.strictEqual(args.id, "bpl_abc123", "blueprint_id maps to id");
  assert.strictEqual(args.blueprint_id, undefined, "blueprint_id removed");
}

// 2) Unknown argument names are rejected loudly (no silent fallback).
{
  const schema = byName("rancang_next_task");
  assert.throws(
    () => checkArgs(schema, { dashbord_id: "bpl_x" }),
    /Unknown argument: dashbord_id/,
    "unknown key must throw"
  );
}

// 3) task_complete requires BOTH id and task_id (write path must be explicit).
{
  const schema = byName("rancang_task_complete");
  assert.throws(
    () => checkArgs(schema, { task_id: "T001" }),
    /Missing required argument: id/,
    "id required for task_complete"
  );
  assert.throws(
    () => checkArgs(schema, { id: "bpl_abc123" }),
    /Missing required argument: task_id/,
    "task_id required for task_complete"
  );
  const ok = checkArgs(schema, { id: "bpl_abc123", task_id: "T001", done: "true" });
  assert.strictEqual(ok.done, true, "string 'true' coerced to boolean");
}

// 4) read/next accept an omitted id (falls back server-side) but still reject junk.
{
  const ok = checkArgs(byName("rancang_next_task"), {});
  assert.strictEqual(ok.id, undefined, "id optional for read-only tools");
  const bad = checkArgs(byName("rancang_read_blueprint"), { docs: "spec,plan" });
  assert.deepStrictEqual(bad.docs, ["spec", "plan"], "string array coerced");
}

console.log("PASS: mcp tools argument handling");