// Self-check for the "Firestore wins on conflict by createdAt" merge rule used in use-sync.ts.
// Run: node src/lib/sync-merge.test.mjs
import assert from "node:assert";

function shouldTakeRemote(local, remote) {
  return !local || remote.createdAt >= local.createdAt;
}

// No local copy: always take remote.
assert.strictEqual(shouldTakeRemote(undefined, { createdAt: 100 }), true);

// Remote newer: take remote.
assert.strictEqual(shouldTakeRemote({ createdAt: 100 }, { createdAt: 200 }), true);

// Remote older: keep local.
assert.strictEqual(shouldTakeRemote({ createdAt: 200 }, { createdAt: 100 }), false);

// Tie: remote wins (Firestore is source of truth).
assert.strictEqual(shouldTakeRemote({ createdAt: 100 }, { createdAt: 100 }), true);

console.log("sync-merge.test.mjs: all assertions passed");
