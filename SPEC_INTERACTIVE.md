Redesign the PRD generation flow on the /plan page to be interactive instead of free-text-only, plus another visual polish pass. Two parts.

## Part 1 — Interactive clarifying questions before PRD generation

Currently `/plan` takes a raw idea string and streams a full PRD directly. Change this to a two-step flow:

### Step A: Get clarifying questions
- New API route `POST /api/plan/clarify` — takes `{ idea: string }`, calls the LLM (use `getDefaultModel()` same as today) with a system prompt instructing it to return ONLY valid JSON (no markdown fences, no commentary) matching this shape:
  ```ts
  type ClarifyResponse = {
    intro: string; // 1-2 sentence framing of what's being asked and why (e.g. the "Rung 1 check" style reasoning), can be empty string
    questions: Array<{
      id: string; // short slug, e.g. "users", "reimbursement_types"
      question: string;
      type: "single" | "multi"; // single = radio (pick exactly one), multi = checkbox (pick any number)
      options: Array<{ id: string; label: string; allowsNote?: boolean }>; // allowsNote = true means this option should show a small text input for a free-text detail (e.g. "Other: specify")
    }>;
  };
  ```
  - Ask for 3-6 questions max, each with 2-5 options. This is not a chat — it's a one-shot structured call (non-streaming, just `stream: false` and parse the JSON response). Add a `parseJsonLoose` helper that strips markdown code fences if the model wraps the JSON anyway (defensive, models sometimes do this despite instructions).
  - Return `NextResponse.json(clarifyResponse)`. On parse failure or LLM error, return a clear error so the client can fall back to the old flow (see below).

### Step B: Generate the PRD using idea + answers
- Modify `POST /api/plan` (existing streaming route) to accept an optional second field: `{ idea: string, answers?: Array<{ question: string; selected: string[]; note?: string }> }`.
  - If `answers` is provided, append a clearly formatted "Clarifying answers:" block to the user message before the idea (or merge into one user message) so the LLM's PRD reflects the user's choices.
  - If `answers` is omitted (backward compatible), behave exactly as today.

### Client UI (`/plan` page)
- Flow: user types idea → clicks "Generate PRD" → app calls `/api/plan/clarify` first (show a small loading state, e.g. "Analyzing your idea...").
  - If clarify succeeds and returns >=1 question: render a clean interactive form — one card/section per question, radio buttons (`type: "single"`) or checkboxes (`type: "multi"`) using shadcn/ui-style components (add `src/components/ui/radio-group.tsx` and `src/components/ui/checkbox.tsx` — Base UI primitives, this project uses `@base-ui/react`, follow the same pattern as the existing `select.tsx`/`switch.tsx` for how they wrap Base UI). Any option with `allowsNote: true` and currently selected reveals a small inline text input for the detail. Show the `intro` text above the questions if non-empty. A "Generate PRD" button at the bottom (disabled until every question has at least one selection) triggers Step B with the collected answers, then streams the result into the existing preview pane exactly like today.
  - If clarify fails (network error, bad JSON, LLM error) — don't block the user. Fall back silently to the original one-shot flow: call `/api/plan` directly with just the idea, no clarifying step. Log a console.warn, no visible error to the user.
  - Add a "Skip questions, generate directly" text link/button near the question form so the user isn't forced through clarification if they don't want it — clicking it calls `/api/plan` with just the idea.
  - After the PRD streams in and is saved (existing `planStore.save` + `sync.syncPlan` logic), reset back to the idea input so the user can start a new one — same as current behavior after generation completes.

## Part 2 — Another visual/theme polish pass
- General refinement pass on top of the previous one: tighten color contrast (dark theme should feel intentional, not just "dark gray on black" — use the existing CSS variables/Tailwind theme tokens already defined, don't introduce a new palette), consistent card elevation (shadow/border) across landing, chat, plan, and the new clarify-question cards, consistent button sizing/spacing, make sure focus states (keyboard nav) are visible on inputs/buttons/radio/checkbox for accessibility.
- Look overall more like a polished SaaS product (comparable bar: Linear, Vercel dashboard — clean, confident, not flashy) rather than a generic shadcn starter. Use existing Tailwind/shadcn primitives; do not introduce a new design system or CSS framework.

## Constraints
- Do not touch storage-scope isolation (`storage.ts`, `auth-provider.tsx`), the AuthGate on /chat and /plan, Firestore sync logic, or the LLM streaming plumbing in `llm.ts` (`toTextDeltaStream`, `streamChatCompletion`) — those are unchanged, working, and tested. You may ADD a non-streaming call variant in `llm.ts` if needed for the clarify endpoint (e.g. `chatCompletion()` that awaits the full JSON response instead of streaming), but don't modify the existing streaming functions.
- `/plan` must remain gated behind AuthGate exactly as before.
- `npm run build` must succeed with no Firebase env vars set, and separately with dummy Firebase env vars set.
- Do not add new dependencies beyond what's needed for the new Base UI radio-group/checkbox primitives (check if `@base-ui/react` already exports what you need — it should, same package already used for select/switch).

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds, no Firebase env vars set
2. `npm run build` succeeds, dummy Firebase env vars set
3. TypeScript/ESLint clean
4. `/api/plan/clarify` returns valid structured JSON for a real test idea (call it for real and show the actual response)
5. Clarify UI renders radio/checkbox questions correctly based on `type`, "allowsNote" options show a text input when selected
6. "Generate PRD" button disabled until all questions answered, then streams a real PRD that incorporates the answers (test end-to-end with a real idea + real answers, show the actual generated PRD or a meaningful excerpt)
7. "Skip questions, generate directly" bypasses clarification and calls /api/plan directly
8. If clarify endpoint fails, falls back silently to direct generation (test by temporarily breaking the clarify call, e.g. wrong URL, confirm fallback works, then revert)
9. Existing test suite (storage-scope, sync-merge, llm think-tag stripping) still passes
10. Visual polish applied consistently, focus states visible on new form elements

Report the checklist results when done, and flag anything you had to deviate from and why. For #4 and #6 specifically, paste real output, not a description of what should happen.
