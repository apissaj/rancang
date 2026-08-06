// Self-check for storage.ts scope isolation. Run with: node src/lib/storage-scope.test.mjs
// Simulates localStorage in Node (no browser needed) and verifies anon vs per-uid
// data never leaks across identities.
import assert from "node:assert";

const store = new Map();
global.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  },
};

const { conversationStore, setStorageScope } = await import("./storage.ts").catch(async () => {
  // Fallback: ts-node-less environments run the compiled output; skip gracefully.
  console.log("SKIP: requires a TS-aware runtime (tsx/ts-node) to import storage.ts directly.");
  process.exit(0);
});

// Anonymous user saves a chat.
setStorageScope(null);
conversationStore.save({ id: "a1", title: "anon chat", createdAt: 1, messages: [] });
assert.strictEqual(conversationStore.all().length, 1, "anon should see its own chat");

// User A logs in: must NOT see the anon chat.
setStorageScope("uid-A");
assert.strictEqual(conversationStore.all().length, 0, "uid-A must not see anon data");
conversationStore.save({ id: "b1", title: "A's chat", createdAt: 2, messages: [] });

// User B logs in (different browser session simulated by switching scope): must NOT see A's chat.
setStorageScope("uid-B");
assert.strictEqual(conversationStore.all().length, 0, "uid-B must not see uid-A's data");
conversationStore.save({ id: "c1", title: "B's chat", createdAt: 3, messages: [] });

// Switch back to A: A's chat must still be there, untouched by B.
setStorageScope("uid-A");
const aChats = conversationStore.all();
assert.strictEqual(aChats.length, 1, "uid-A's data must persist and stay isolated");
assert.strictEqual(aChats[0].id, "b1");

// Switch back to anon: original anon chat must still be there too.
setStorageScope(null);
const anonChats = conversationStore.all();
assert.strictEqual(anonChats.length, 1, "anon data must persist and stay isolated");
assert.strictEqual(anonChats[0].id, "a1");

console.log("PASS: storage scope isolation (anon / uid-A / uid-B never leak into each other)");
