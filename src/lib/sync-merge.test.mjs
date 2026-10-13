// Self-check for the "Firestore wins on conflict by createdAt" merge rule used in use-sync.ts.
// Run: node src/lib/sync-merge.test.mjs
import assert from "node:assert";
import { mergePlan, shouldTakeRemote } from "./sync-merge.ts";

assert.strictEqual(shouldTakeRemote(undefined, { createdAt: 100 }), true);
assert.strictEqual(shouldTakeRemote({ createdAt: 100 }, { createdAt: 200 }), true);
assert.strictEqual(shouldTakeRemote({ createdAt: 200 }, { createdAt: 100 }), false);
assert.strictEqual(shouldTakeRemote({ createdAt: 100 }, { createdAt: 100 }), true);

const remoteNoMcp = { id: "p1", title: "remote", idea: "", markdown: "", createdAt: 100, versions: [] };

const tieKeepsLocalMcp = mergePlan({ ...remoteNoMcp, title: "local", mcpId: "bp-LOCAL" }, remoteNoMcp);
assert.strictEqual(tieKeepsLocalMcp.mcpId, "bp-LOCAL");
assert.strictEqual(tieKeepsLocalMcp.title, "remote");

const localNewer = { ...remoteNoMcp, createdAt: 300, title: "local-newer", mcpId: "bp-LOCAL" };
assert.strictEqual(mergePlan(localNewer, remoteNoMcp), localNewer);

const missingLocal = mergePlan(undefined, remoteNoMcp);
assert.strictEqual(missingLocal, remoteNoMcp);
assert.strictEqual("mcpId" in missingLocal, false);

console.log("sync-merge.test.mjs: all assertions passed");
