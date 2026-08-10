Add manual editing + AI-instructed editing + version history to PRD records on this existing Next.js app (PRD Forge /plan page). Do NOT touch AuthGate, storage-scope isolation, compare-mode generation, or the clarify flow.

## Data model change (`src/lib/storage.ts`)
Change `PlanRecord`:
```ts
export type PlanVersion = {
  id: string;          // nanoid
  markdown: string;
  createdAt: number;
  source: "generated" | "manual-edit" | "ai-edit";
  note?: string;        // for ai-edit: the instruction given; for manual-edit: optional label
};

export type PlanRecord = {
  id: string;
  title: string;
  idea: string;
  markdown: string;      // ALWAYS mirrors versions[versions.length - 1].markdown (current/latest)
  createdAt: number;      // unchanged: original creation time, used for sort/sync-merge — do not change this field's meaning
  versions: PlanVersion[]; // ordered oldest -> newest, always >=1 entry
};
```
- Migration: existing localStorage records won't have `versions`. In `planStore.all()` / wherever records are read, if `versions` is missing/empty, synthesize a single version from the existing `markdown`/`createdAt` fields (`source: "generated"`) so old data doesn't break or disappear.
- `planStore.save(plan: PlanRecord)` behavior unchanged (upsert by id) — callers now pass the full record including its `versions` array.

## New API route — AI-instructed edit
`POST /api/plan/edit` — body `{ markdown: string, instruction: string }`. System prompt: "You are revising an existing PRD based on the user's instruction. Return the FULL revised PRD in the same Markdown structure/sections, not a diff or partial excerpt, no preamble/commentary." User message: the current markdown + the instruction, clearly delimited. Stream the response the same way `/api/plan` does (reuse `streamChatCompletion` + `toTextDeltaStream` from `llm.ts`, `getDefaultModel()`). Same non-streaming/streaming conventions as the existing route.

## UI (`/plan` page, preview pane)
Add to the preview pane header (next to existing Copy/Download buttons):
- **"Edit" button** (only visible when a plan is loaded/generated, i.e. `markdown` non-empty and not currently loading/streaming) — toggles the preview between rendered Markdown and an editable `Textarea` with the raw markdown. While editing: "Save" and "Cancel" buttons. Save appends a new `PlanVersion` (`source: "manual-edit"`) to the active record's `versions`, updates `markdown` to match, calls `planStore.save` + `sync.syncPlan`, exits edit mode. Cancel discards changes, exits edit mode, no version added.
- **AI edit**: a small input + "Revise" button (e.g. placeholder "Ubah bagian X jadi... / Add a section about... / Make goals more specific") shown alongside the Edit button (not inside edit mode — this works on the rendered view). Clicking "Revise" calls `/api/plan/edit` with the current markdown + instruction, streams the result into the preview (same streaming pattern as generation), and on completion appends a new `PlanVersion` (`source: "ai-edit"`, `note: instruction`), updates `markdown`, saves via `planStore.save` + `sync.syncPlan`.
- **Version history**: a small dropdown/select near the preview header showing all versions of the active record, newest first, labeled e.g. "v3 · AI edit · 2m ago", "v2 · Manual edit", "v1 · Generated". Selecting an older version loads it read-only into the preview with a banner "Viewing v2 (not current) — [Restore this version]" button. "Restore" appends a NEW version (`source` = same as the restored version's original source, or just reuse `"manual-edit"` for simplicity, `note: "Restored from v2"`) with that version's markdown as the newest, i.e. restoring never deletes history, it just makes the old content current again as a new version entry.
- Compare-mode results: each column-result PlanRecord gets a fresh single-entry `versions` array (`source: "generated"`) same as single-mode — no special handling needed beyond the data model change already covering it.
- Sidebar (`plan-sidebar.tsx`) list items: no required change, but if trivial, show a small version count badge (e.g. "3 versions") — skip if it complicates things, not required.

## Constraints
- Do not touch AuthGate, storage-scope isolation (`storage.ts`'s scope functions), Firestore sync mechanics beyond passing the new `versions` field through (it's just part of the `PlanRecord` shape being synced, `sync/plans` routes need no server logic change since they store/return whatever `PlanRecord` shape is sent — verify this is true, adjust only if Firestore rejects nested arrays which it should not).
- Do not touch compare-mode generation, clarify flow, or `/chat`.
- Do not add new dependencies — reuse existing shadcn/ui `select`/`textarea`/`button`.
- `npm run build` must succeed with no Firebase env vars set, and separately with dummy/real Firebase env vars set.
- Keep `PLAN_LIMIT = 5` (max records shown in sidebar) unchanged — versioning is INSIDE a record, doesn't multiply the record count.

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds, no Firebase env vars set
2. `npm run build` succeeds, real Firebase env vars set (use the `.env` in this repo root)
3. TypeScript/ESLint clean
4. Old-shape localStorage records (no `versions` field) load without crashing, synthesized into a single v1 — test by manually seeding old-shape JSON into localStorage (or writing a small node/test script) and confirming it renders
5. Manual edit: edit markdown, save, confirm new version appended and `markdown` field updated — real test
6. AI edit: real instruction sent to `/api/plan/edit`, real streamed revised PRD, confirm it reflects the instruction (paste real excerpt showing before/after difference) — test with a real idea + real instruction like "Add a Data Model section" or similar
7. Version history dropdown lists all versions correctly ordered, restoring an old version creates a new latest version (doesn't delete anything) — verify version count increases
8. Existing test suite still passes (`node --test src/lib/*.test.mjs`)
9. Compare-mode and single-mode generation still work unchanged

Report checklist results when done. For #6 specifically, paste real before/after markdown excerpts, not a description.
