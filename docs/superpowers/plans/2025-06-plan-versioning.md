# PRD Versioning (Manual Edit + AI Edit + Version History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual editing, AI-instructed editing, and version history to PRD records on the `/plan` page, per `SPEC_VERSIONING.md`.

**Architecture:** Extend `PlanRecord` with a `versions: PlanVersion[]` array (data model + migration in `storage.ts`), add `POST /api/plan/edit` (mirrors existing `/api/plan` streaming route), and extend `/plan` page preview pane with Edit/Save/Cancel, AI-revise input, and a version-history `Select`. No new deps.

**Tech Stack:** Next.js App Router, existing shadcn/ui (`select`, `textarea`, `button`), `nanoid`, existing `llm.ts` streaming helpers.

---

### Task 1: Data model + migration in `storage.ts`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `src/lib/plan-versions.test.mjs` (new)

- [ ] **Step 1: Write failing test for migration + versions shape**

Create `src/lib/plan-versions.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node src/lib/plan-versions.test.mjs`
Expected: FAIL (import error or `versions` undefined) since `storage.ts` doesn't have `PlanVersion`/migration yet.

- [ ] **Step 3: Implement `PlanVersion` type, updated `PlanRecord`, and migration**

Replace the `PlanRecord` type and `planStore` in `src/lib/storage.ts`:

```ts
export type PlanVersion = {
  id: string;
  markdown: string;
  createdAt: number;
  source: "generated" | "manual-edit" | "ai-edit";
  note?: string;
};

export type PlanRecord = {
  id: string;
  title: string;
  idea: string;
  markdown: string;
  createdAt: number;
  versions: PlanVersion[];
};
```

Add a migration helper and use it in `planStore.all()` and inside `read` for plans specifically (keep `read<T>` generic and untouched; migrate at the `planStore` layer so `conversationStore` is unaffected):

```ts
function migratePlan(p: PlanRecord & { versions?: PlanVersion[] }): PlanRecord {
  if (p.versions && p.versions.length > 0) return p as PlanRecord;
  return {
    ...p,
    versions: [
      { id: `${p.id}-v1`, markdown: p.markdown, createdAt: p.createdAt, source: "generated" },
    ],
  };
}

export const planStore = {
  all: () => read<PlanRecord>(planKey()).map(migratePlan).sort((a, b) => b.createdAt - a.createdAt),
  save: (plan: PlanRecord) => {
    const all = read<PlanRecord>(planKey()).map(migratePlan).filter((p) => p.id !== plan.id);
    all.unshift(plan);
    write(planKey(), all.slice(0, PLAN_LIMIT));
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node src/lib/plan-versions.test.mjs`
Expected: `PASS: plan versions migration + passthrough` (or the TS-runtime SKIP message if `tsx`/`ts-node` unavailable — check how `storage-scope.test.mjs` is actually invoked in this repo, e.g. `npx tsx src/lib/plan-versions.test.mjs`, and use the same runner).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/plan-versions.test.mjs
git commit -m "feat: add PlanVersion type + migration to storage.ts"
```

---

### Task 2: `POST /api/plan/edit` route

**Files:**
- Create: `src/app/api/plan/edit/route.ts`

- [ ] **Step 1: Implement the route** (mirrors `src/app/api/plan/route.ts` streaming pattern; no test framework exists for API routes in this repo — verified manually in Task 4's checklist item 6)

```ts
import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are revising an existing PRD based on the user's instruction. Return the FULL revised PRD in the same Markdown structure/sections, not a diff or partial excerpt, no preamble/commentary.`;

function buildUserMessage(markdown: string, instruction: string): string {
  return `Current PRD:\n---\n${markdown}\n---\n\nInstruction:\n${instruction}`;
}

export async function POST(req: Request) {
  const { markdown, instruction } = (await req.json()) as { markdown: string; instruction: string };

  if (!markdown || !markdown.trim()) {
    return new Response("markdown is required", { status: 400 });
  }
  if (!instruction || !instruction.trim()) {
    return new Response("instruction is required", { status: 400 });
  }

  try {
    const upstream = await streamChatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(markdown, instruction) },
    ]);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 502 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/plan/edit/route.ts
git commit -m "feat: add /api/plan/edit route for AI-instructed PRD revision"
```

---

### Task 3: Update plan generation call sites to populate `versions`

**Files:**
- Modify: `src/app/plan/page.tsx`

- [ ] **Step 1: Update the two `PlanRecord` construction sites in `generatePrd`**

In the compare-mode branch, change:

```ts
            const record: PlanRecord = {
              id: nanoid(),
              title: `${ideaText.slice(0, 60)} (${m})`,
              idea: ideaText,
              markdown: full,
              createdAt: Date.now(),
            };
```

to:

```ts
            const now = Date.now();
            const record: PlanRecord = {
              id: nanoid(),
              title: `${ideaText.slice(0, 60)} (${m})`,
              idea: ideaText,
              markdown: full,
              createdAt: now,
              versions: [{ id: nanoid(), markdown: full, createdAt: now, source: "generated" }],
            };
```

In the single-mode branch, change:

```ts
      const record: PlanRecord = {
        id: nanoid(),
        title: ideaText.slice(0, 60),
        idea: ideaText,
        markdown: full,
        createdAt: Date.now(),
      };
```

to:

```ts
      const now = Date.now();
      const record: PlanRecord = {
        id: nanoid(),
        title: ideaText.slice(0, 60),
        idea: ideaText,
        markdown: full,
        createdAt: now,
        versions: [{ id: nanoid(), markdown: full, createdAt: now, source: "generated" }],
      };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `PlanRecord` missing `versions`.

- [ ] **Step 3: Commit**

```bash
git add src/app/plan/page.tsx
git commit -m "feat: populate versions array on PRD generation (single + compare mode)"
```

---

### Task 4: Preview pane UI — Edit/Save/Cancel, AI revise, version history

**Files:**
- Modify: `src/app/plan/page.tsx`

- [ ] **Step 1: Add state for edit mode, AI-edit, and version viewing**

Add near the existing `useState` declarations in `PlanPage`:

```ts
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null); // null = current
```

Add a derived helper to get the active record and its versions (place after `activeId` state, before the JSX return):

```ts
  const activePlan = activeId ? plans.find((p) => p.id === activeId) ?? null : null;
  const versions = activePlan?.versions ?? [];
  const viewedVersion = viewingVersionId ? versions.find((v) => v.id === viewingVersionId) ?? null : null;
  const displayedMarkdown = viewedVersion ? viewedVersion.markdown : markdown;
```

- [ ] **Step 2: Reset new state when switching plans / generating**

In the `loadPlan` function, add resets:

```ts
  const loadPlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setActiveId(id);
    setIdea(plan.idea);
    setMarkdown(plan.markdown);
    setError(null);
    setClarify(null);
    setCompareColumns(null);
    setEditing(false);
    setViewingVersionId(null);
    setAiInstruction("");
  };
```

In `generatePrd`, after `setActiveId(record.id);` in the single-mode success path, add `setViewingVersionId(null); setEditing(false);` (compare mode doesn't set an active id/preview so no change needed there).

- [ ] **Step 3: Add save/cancel/restore/AI-revise handlers**

Add these functions in `PlanPage`, near `copyMarkdown`/`downloadMarkdown`:

```ts
  const persistNewVersion = (record: PlanRecord, version: PlanVersion) => {
    const updated: PlanRecord = { ...record, markdown: version.markdown, versions: [...record.versions, version] };
    planStore.save(updated);
    sync.syncPlan(updated);
    setPlans(planStore.all());
    setMarkdown(updated.markdown);
    setViewingVersionId(null);
    return updated;
  };

  const startEdit = () => {
    setEditDraft(markdown);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = () => {
    if (!activePlan) return;
    persistNewVersion(activePlan, {
      id: nanoid(),
      markdown: editDraft,
      createdAt: Date.now(),
      source: "manual-edit",
    });
    setEditing(false);
  };

  const runAiEdit = async () => {
    if (!activePlan || !aiInstruction.trim() || aiEditing) return;
    setAiEditing(true);
    setError(null);
    const instruction = aiInstruction;
    try {
      const res = await fetch("/api/plan/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, instruction }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMarkdown(full);
      }
      persistNewVersion(activePlan, {
        id: nanoid(),
        markdown: full,
        createdAt: Date.now(),
        source: "ai-edit",
        note: instruction,
      });
      setAiInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiEditing(false);
    }
  };

  const restoreVersion = () => {
    if (!activePlan || !viewedVersion) return;
    persistNewVersion(activePlan, {
      id: nanoid(),
      markdown: viewedVersion.markdown,
      createdAt: Date.now(),
      source: "manual-edit",
      note: `Restored from v${versions.findIndex((v) => v.id === viewedVersion.id) + 1}`,
    });
  };
```

Add `PlanVersion` to the import from `@/lib/storage`:

```ts
import { planStore, type PlanRecord, type PlanVersion } from "@/lib/storage";
```

- [ ] **Step 4: Add version-relative-time label helper**

Add near the top-level helper functions (outside the component, next to `type Answer`):

```ts
function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function versionLabel(v: PlanVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Generated" : v.source === "manual-edit" ? "Manual edit" : "AI edit";
  return `v${index + 1} · ${sourceLabel} · ${timeAgo(v.createdAt)}`;
}
```

- [ ] **Step 5: Replace the Preview pane header + body JSX**

Replace this block:

```tsx
          <div className="flex slot">
```

(Note: find the exact current block below and replace it — do not guess indentation, copy verbatim from the current file.)

Replace:

```tsx
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-2/3">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyMarkdown} disabled={!markdown}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Markdown
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMarkdown(markdown)} disabled={!markdown}>
                  <Download className="h-3.5 w-3.5" />
                  Download .md
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {markdown ? (
                <Markdown content={markdown} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your generated PRD will stream in here live.
                </p>
              )}
            </div>
          </div>
```

with:

```tsx
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-2/3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
              <span className="text-sm font-medium">Preview</span>
              <div className="flex flex-wrap items-center gap-2">
                {activePlan && versions.length > 0 && !editing && (
                  <Select
                    value={viewingVersionId ?? "current"}
                    onValueChange={(v) => setViewingVersionId(v === "current" ? null : v)}
                  >
                    <SelectTrigger className="h-8 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...versions].reverse().map((v) => {
                        const idx = versions.findIndex((x) => x.id === v.id);
                        const isLatest = idx === versions.length - 1;
                        return (
                          <SelectItem key={v.id} value={isLatest ? "current" : v.id}>
                            {versionLabel(v, idx)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                {!editing && markdown && !loading && (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    Edit
                  </Button>
                )}
                {editing && (
                  <>
                    <Button size="sm" onClick={saveEdit}>
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={copyMarkdown} disabled={!markdown}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Markdown
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMarkdown(markdown)} disabled={!markdown}>
                  <Download className="h-3.5 w-3.5" />
                  Download .md
                </Button>
              </div>
            </div>
            {!editing && markdown && !loading && activePlan && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Ubah bagian X jadi... / Add a section about... / Make goals more specific"
                  className="h-8 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={aiEditing}
                />
                <Button size="sm" onClick={runAiEdit} disabled={aiEditing || !aiInstruction.trim()}>
                  {aiEditing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {aiEditing ? "Revising..." : "Revise"}
                </Button>
              </div>
            )}
            {viewedVersion && (
              <div className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm">
                <span>
                  Viewing v{versions.findIndex((v) => v.id === viewedVersion.id) + 1} (not current)
                </span>
                <Button size="sm" variant="outline" onClick={restoreVersion}>
                  Restore this version
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-auto p-4">
              {editing ? (
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="h-full min-h-[300px] resize-none font-mono text-xs"
                />
              ) : displayedMarkdown ? (
                <Markdown content={displayedMarkdown} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your generated PRD will stream in here live.
                </p>
              )}
            </div>
          </div>
```

- [ ] **Step 6: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/plan/page.tsx
git commit -m "feat: add manual edit, AI edit, and version history UI to /plan preview"
```

---

### Task 5: Build verification (no env, then with real `.env`)

**Files:** none (verification only)

- [ ] **Step 1: Build with no Firebase env vars**

Run:
```bash
env -u FIREBASE_PROJECT_ID -u FIREBASE_CLIENT_EMAIL -u FIREBASE_PRIVATE_KEY -u NEXT_PUBLIC_FIREBASE_API_KEY npm run build
```
(Adjust the exact var names to whatever `firebase-admin.ts`/`firebase-client.ts` read — check those two files first with `grep -o 'process.env.[A-Z_]*' src/lib/firebase-admin.ts src/lib/firebase-client.ts` and unset all of them.)

Expected: build succeeds (exit code 0).

- [ ] **Step 2: Build with real `.env` values**

Run:
```bash
npm run build
```
(picks up `.env` in repo root automatically via Next.js)

Expected: build succeeds (exit code 0).

- [ ] **Step 3: Run existing + new test suite**

Run: `node --test src/lib/*.test.mjs` (or the project's actual TS-aware runner if `storage-scope.test.mjs` requires one — match whatever command already works in this repo for that file).

Expected: all pass, including new `plan-versions.test.mjs`.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: verify build + tests for plan versioning feature"
```

(Skip commit if nothing changed.)

---

### Task 6: Manual end-to-end verification (per spec's deliverables checklist)

**Files:** none (manual verification only, using `npm run dev`)

- [ ] **Step 1: Old-shape localStorage migration test**

Run `npm run dev`, open `/plan` in browser, open devtools console, run:
```js
localStorage.setItem("prd-forge:anon:plans", JSON.stringify([{id:"old1",title:"Old",idea:"x",markdown:"# Old PRD",createdAt:Date.now()}]));
location.reload();
```
Click the "Old" item in the sidebar. Expected: loads without crashing, shows "# Old PRD", version dropdown shows "v1 · Generated · ...".

- [ ] **Step 2: Manual edit test**

Generate a real PRD from an idea. Click "Edit", change text in the textarea, click "Save". Expected: preview shows edited content, version dropdown now has 2 entries, `localStorage` plan record's `markdown` matches the edit.

- [ ] **Step 3: AI edit test**

With a generated PRD loaded, type an instruction like "Add a Data Model section" into the Revise input, click "Revise". Expected: streamed response appears in preview, final content includes the requested change, version dropdown gains a new "AI edit" entry with the instruction as note. Capture a real before/after excerpt for the report.

- [ ] **Step 4: Version history + restore test**

Open the version dropdown, select an older version. Expected: banner "Viewing vN (not current)" appears, content is read-only (no Edit/Revise controls shown). Click "Restore this version". Expected: new latest version appended, dropdown count increases, banner disappears, content matches restored version.

- [ ] **Step 5: Regression check — compare mode + single mode generation**

Run a normal single-mode generation and a compare-mode generation (2-3 models). Expected: both work exactly as before, no errors, records appear in sidebar.

- [ ] **Step 6: Report results**

Compile the 9-item deliverables checklist from `SPEC_VERSIONING.md` with pass/fail and real evidence (before/after markdown excerpt for AI edit, version counts, etc).

---

## Self-Review Notes (for the plan author, already applied above)

- Spec coverage: data model + migration (Task 1), API route (Task 2), generation call sites (Task 3), UI edit/AI-edit/version history (Task 4), build/test verification (Task 5), manual e2e checklist (Task 6) — all spec sections covered.
- No placeholders: all steps contain full code or exact commands.
- Type consistency: `PlanVersion`/`PlanRecord` shape defined once in Task 1, reused identically in Tasks 3-4 (`nanoid()`, `source`, `note` fields match).
