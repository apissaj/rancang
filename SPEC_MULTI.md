Two fixes/features on this existing Next.js app (PRD Forge). Do NOT touch AuthGate, storage-scope isolation, or the LLM streaming plumbing in llm.ts beyond what's needed below.

## Part 1 — Firestore sync intermittently fails with DEADLINE_EXCEEDED
Already patched in `src/lib/firebase-admin.ts`: `getAdminDb()` now calls `db.settings({ preferRest: true })` once before first use, to force REST transport instead of gRPC (gRPC's long-lived HTTP/2 streams get dropped by the NAS/tunnel network, causing 60s timeouts). Verify this is still in place, don't revert it. If a real end-to-end sync test still fails after this change, investigate further and report exact error.

## Part 2 — Multi-model PRD comparison on /plan
Currently `/plan` always generates the PRD with a single hardcoded model (`getDefaultModel()` from `src/lib/models.ts`). Add a "Compare models" option, similar in spirit to the existing Comparison mode on `/chat` (see `src/components/chat/comparison-view.tsx` for the pattern — reuse/adapt where it makes sense, but /plan's layout is different — full-width columns work better here than the chat's side panel).

### UI (`/plan` page)
- Add a model picker area above/near the idea textarea: a single-select dropdown (default = current default model) PLUS a "Compare models" toggle. When toggle is ON, replace the single dropdown with a multi-select (checkboxes or a simple multi-select dropdown) of 2-3 models from `getAvailableModels()` (`src/lib/models.ts`). Cap selection at 3 models (disable further checkboxes past 3, or show a small note).
- Clarifying-questions step (existing `/api/plan/clarify` flow) stays unchanged and single-model (use the currently selected single model, or the first selected model in compare mode, for the clarify call — clarify doesn't need to run N times).
- On "Generate PRD":
  - Single-model mode (default, unchanged behavior): stream into the existing preview pane exactly as today.
  - Compare mode (2-3 models selected): call `/api/plan` once per selected model in parallel, each streaming independently, and render them side-by-side in columns (grid, responsive: stack on mobile, same visual pattern as `comparison-view.tsx` — one column per model with a header showing the model name, streaming markdown body, loading indicator until first token).
  - Each column has its own "Copy Markdown" and "Download .md" button once that column's stream completes.
  - Saving to history/localStorage (`planStore.save` + `sync.syncPlan`): in compare mode, save each completed generation as a SEPARATE `PlanRecord` (so all N results are recoverable from the sidebar later), with the model name appended to the title, e.g. `"{idea} (cx/gpt-5.5)"`. Do not change the `PlanRecord` type shape.

### API (`src/app/api/plan/route.ts`)
- Add optional `model` field to the existing POST body: `{ idea: string, answers?: Answer[], model?: string }`. If provided, use it instead of `getDefaultModel()`. If omitted, behave exactly as today (backward compatible — the /chat route and any other caller must keep working unchanged).
- No new route needed — the client just calls the existing streaming endpoint N times in parallel with different `model` values when in compare mode.

## Constraints
- Do not touch AuthGate, storage-scope isolation (`storage.ts`, `auth-provider.tsx`), Firestore sync logic beyond Part 1, or `/chat`'s existing comparison mode.
- Do not add new dependencies — use existing shadcn/ui primitives (checkbox, select, dropdown-menu already in the project).
- `npm run build` must succeed with no Firebase env vars set, and separately with dummy Firebase env vars set.
- Single-model mode must remain the default and behave pixel-identical to current behavior (no regressions) — compare mode is strictly additive/opt-in.

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds, no Firebase env vars set
2. `npm run build` succeeds, dummy Firebase env vars set
3. TypeScript/ESLint clean
4. Single-model generation (compare OFF) still works exactly as before — test with a real idea
5. Compare mode: selecting 2-3 models and generating shows that many side-by-side streaming columns, each completing independently, real test with a real idea
6. Each compare-mode result is saved as its own PlanRecord in the sidebar (model name in title), verify by checking localStorage/sidebar after generation
7. Existing test suite (storage-scope, sync-merge, llm think-tag stripping) still passes
8. Firestore sync: confirm `preferRest: true` present in firebase-admin.ts; if you can test a real authenticated sync call, do so and report the result

Report the checklist results when done, and flag anything you had to deviate from and why. For #5 specifically, paste real output or a meaningful excerpt from at least 2 of the compared models, not a description of what should happen.
