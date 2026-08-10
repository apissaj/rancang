Add a new route `/design` to this existing Next.js app (PRD Forge). Separate page from `/plan`, same overall app shell/nav/theme. Turns an existing PRD (or manual idea) into: (a) a DESIGN.md design-token spec file (Google's open DESIGN.md format), (b) a clickable wireframe prototype the user can click through to confirm the screen flow before "producing" the final file to paste into Claude Code / Pi.

## Reference: DESIGN.md format (must follow exactly)
This is Google's `google-labs-code/design.md` spec — YAML front matter + Markdown body. Canonical section order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. Example shape:
```md
---
version: alpha
name: <design name>
description: <one line>
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1: { fontFamily: "...", fontSize: "3rem", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }
  body-md: { fontFamily: "...", fontSize: "1rem" }
rounded: { sm: 4px, md: 8px, lg: 16px }
spacing: { sm: 8px, md: 16px, lg: 24px }
components:
  button-primary: { backgroundColor: "{colors.tertiary}", textColor: "#FFFFFF", rounded: "{rounded.sm}", padding: 12px }
  button-primary-hover: { backgroundColor: "{colors.primary}" }
---
## Overview
...
## Colors
...
## Typography
...
## Layout
(note responsive breakpoints here if platform = both)
## Elevation & Depth
...
## Shapes
...
## Components
...
## Do's and Don'ts
...
```
Rules: hex colors as quoted strings, component variants (hover/active) are separate sibling keys not nested, token references use `{colors.primary}` dotted-path syntax.

## Data model (`src/lib/storage.ts`)
Add alongside existing types (do not modify `PlanRecord`/`PlanVersion`/`Conversation`):
```ts
export type ScreenComponent = { type: string; label: string; onClick?: string /* -> target screen id, or omitted = no nav */ };
export type Screen = { id: string; name: string; platform: "mobile" | "web"; components: ScreenComponent[] };

export type DesignVersion = {
  id: string;
  designMd: string;
  screens: Screen[];
  createdAt: number;
  source: "generated" | "manual-edit" | "ai-edit";
  note?: string;
};

export type DesignRecord = {
  id: string;
  title: string;
  sourceIdea: string;
  sourcePlanId?: string;      // if derived from an existing PlanRecord
  platform: "mobile" | "web" | "both";
  pwa: boolean;
  designMd: string;            // mirrors versions[last].designMd
  screens: Screen[];           // mirrors versions[last].screens
  createdAt: number;
  versions: DesignVersion[];
};
```
Add `designStore` object mirroring `planStore`'s exact shape/pattern (`all()`, `save()`, same `DESIGN_LIMIT = 5`, same localStorage key pattern `prd-forge:${scope}:designs`, same migration-safety idea — though this is a new type so no legacy migration needed, just follow the structural pattern for consistency).

## New API route — single-step generate
`POST /api/design` — body `{ idea: string, planMarkdown?: string, vibe?: string, platform: "mobile" | "web" | "both", pwa: boolean }`.
- Non-streaming (`stream: false`), single LLM call, `getDefaultModel()`, reuse/add a `chatCompletion()` non-streaming helper in `llm.ts` if one doesn't already exist from the clarify feature (check `src/app/api/plan/clarify/route.ts` — reuse its pattern/helper if present).
- System prompt: given an idea (and optional full PRD markdown for context) and platform choice, produce ONLY valid JSON (no markdown fences, no commentary) matching:
  ```ts
  type DesignResponse = {
    designMd: string;   // the full DESIGN.md file content as a single string, following the format above, respecting platform (mobile/web/both — add responsive breakpoint notes in ## Layout if "both") and pwa flag (if pwa, note manifest/service-worker/installable guidance in ## Overview or ## Do's and Don'ts)
    screens: Screen[];  // 4-8 screens derived from the idea's core user flows. If platform is "both", generate the SAME logical screens twice, once with platform:"mobile" ids like "home-mobile" and once platform:"web" ids like "home-web", each with their own onClick targets pointing within their own platform set. If "mobile" or "web" only, generate just that platform's screens.
  };
  ```
  Each screen's `components` should be a rough wireframe list (5-10 items) of things like `{ type: "header", label: "..." }`, `{ type: "button", label: "Get Started", onClick: "onboarding-mobile" }`, `{ type: "list-item", label: "..." }`, `{ type: "input", label: "..." }`, `{ type: "nav-item", label: "Settings", onClick: "settings-mobile" }`. Component `type` is a free-form string the client maps to a rendering style — use a small consistent vocabulary: `header`, `text`, `button`, `input`, `list-item`, `card`, `nav-item`, `image-placeholder`, `divider`.
- Add a `parseJsonLoose` reuse (already exists from clarify feature — check `src/lib/clarify-types.ts` or the clarify route for it, reuse don't duplicate) to strip markdown fences defensively.
- Return `NextResponse.json(designResponse)` on success. Clear error response on parse/LLM failure (client shows the error, no silent fallback needed here since there's no "old flow" to fall back to).

## New API route — AI edit (mirrors `/api/plan/edit`)
`POST /api/design/edit` — body `{ designMd: string, screens: Screen[], instruction: string }`. Same non-streaming JSON-response pattern as `/api/design` (not the plan edit route's streaming pattern — screens is structured data, must stay valid JSON, so this one is non-streaming too, returning the full revised `{ designMd, screens }` pair). System prompt: "revise the DESIGN.md and/or screens based on the instruction, return the complete updated JSON in the same shape, not a diff."

## Sync routes (mirror `/api/sync/plans` exactly)
- `GET/POST /api/sync/designs`, `DELETE /api/sync/designs/[id]` — same auth check (`requireUid` from `sync-auth.ts`), same Firestore collection pattern (`users/{uid}/designs/{id}`), same shape passthrough (no server-side validation beyond what plans already do).
- Wire into `use-sync.ts`: add `syncDesign`/`deleteDesignRemote` alongside existing `syncConversation`/`syncPlan`, follow the exact same pattern (migration push on login, merge on load, Firestore-wins-by-createdAt).

## UI — new page `src/app/design/page.tsx`
Gated behind `AuthGate` (same as `/plan`, `/chat`). Layout: sidebar (design history, mirrors `PlanSidebar` pattern — create `src/components/design/design-sidebar.tsx`) + main area.

### Step 1 — Setup form
- Idea textarea (or a dropdown to pick from an existing `PlanRecord` via `planStore.all()` — selecting one pre-fills the idea and passes that plan's current markdown as `planMarkdown` context; manual free-text idea also allowed, no PRD required).
- Optional "vibe" text input (placeholder: e.g. "playful, pastel" or "corporate, dark, minimal").
- Platform picker: three-way toggle/radio — **Mobile**, **Web**, **Both**.
- PWA checkbox — only visible/enabled when platform is Mobile or Both.
- "Generate Design" button → calls `/api/design`, shows a loading state (this is a single request, not streamed — show a spinner + "Designing..." text, it may take 10-30s).

### Step 2 — Clickable prototype + DESIGN.md preview (after generate succeeds)
Two-pane layout (similar split to `/plan`'s form/preview split, but here BOTH panes are results, no form takes primary space anymore — collapse the setup form into a small header bar showing the current idea/platform/vibe with an "Edit setup" way to go back).

- **Left pane — Prototype canvas**: renders the CURRENT screen (start at `screens[0]`) using the DESIGN.md tokens (parse the YAML front matter client-side — a small hand-rolled YAML-front-matter extractor is fine, don't add a YAML parsing dependency if avoidable; if genuinely needed, check if `js-yaml` or similar is already a transitive dep before adding one, prefer regex/manual parsing of this constrained subset first). Map each `ScreenComponent.type` to a simple styled div (header → large bold text bar, button → styled button, input → styled input-look div, card → bordered box, list-item → row with left icon placeholder, nav-item → small pill/tab, image-placeholder → gray box with icon, divider → hr, text → paragraph). Apply `colors.primary/secondary/tertiary/neutral`, `rounded`, `spacing` tokens as inline styles or a CSS custom-properties wrapper. Components with `onClick` are real clickable elements — clicking navigates the canvas to that screen id (client-side state, no routing). Show a small breadcrumb/back button and a "Screens: 1/6" style indicator, plus a dropdown to jump to any screen directly.
  - If `platform === "both"`: add a Mobile/Web tab switcher above the canvas that switches between the two screen sets (filter `screens` by `.platform`), each independently navigable, remembering last-viewed screen per tab.
  - Wrap the canvas in a simple device frame: a narrow rounded-corner phone-shaped container for mobile screens (fixed max-width ~375px, subtle shadow/border), a wider frame for web screens. If `pwa` is true, add a minimal browser/app-shell chrome bar on top of the mobile frame (just a thin bar with a dot/icon, purely decorative, signals "installable app" feel) — do not build real PWA functionality (no manifest.json, no service worker), this is a visual cue only.
- **Right pane — DESIGN.md output**: same Edit/AI-revise/version-history pattern as `/plan`'s preview (reuse the interaction pattern from `plan/page.tsx`'s edit mode — manual textarea edit, AI instruction input calling `/api/design/edit`, version dropdown). On AI edit or manual edit, both `designMd` AND `screens` may change together (since `/api/design/edit` returns both) — append one new `DesignVersion` covering both. Copy / Download buttons for the raw `designMd` string (`design.md` filename).
- A **"Produce DESIGN.md"** primary button (visually the main CTA once the user is happy with the prototype) — this is really just a confirm/finalize action: scrolls to / highlights the DESIGN.md pane, ensures the current version is saved via `designStore.save` + `sync.syncDesign` if not already, and shows a brief "Ready — copy or download below" confirmation state. It's a UX checkpoint, not a different code path from what's already saved.

## Constraints
- Do not touch `/plan`, `/chat`, AuthGate, storage-scope isolation, or any existing routes beyond the additive sync-routes/use-sync changes described.
- Do not add new dependencies unless something is genuinely missing (check `package.json` first) — reuse existing shadcn/ui primitives (`select`, `textarea`, `checkbox`, `radio-group`, `button`, `card`).
- `npm run build` must succeed with no Firebase env vars set, and separately with the real Firebase env vars in this repo's `.env`.
- Keep `DESIGN_LIMIT = 5` (sidebar history cap), same pattern as `PLAN_LIMIT`.

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds, no Firebase env vars set
2. `npm run build` succeeds, real Firebase env vars set (this repo's `.env`)
3. TypeScript/ESLint clean
4. `/api/design` called for real with a real idea (e.g. "A habit tracker app"), platform="both", pwa=true — returns valid JSON with non-empty `designMd` (valid YAML front matter, all 8 sections present) and `screens` array with both mobile and web variants, sensible onClick links between screens. Paste real output/excerpt.
5. `/design` page renders the setup form, generates, and shows the clickable prototype — clicking a button/nav-item with an `onClick` target actually navigates the canvas to that screen (verify via browser or describe the exact click-tested flow, don't just claim it)
6. Mobile/Web tab switcher works when platform="both"
7. DESIGN.md pane: manual edit + AI edit (real instruction, real before/after excerpt) + version history all work, same interaction pattern as `/plan`
8. Sync routes for designs work: `firebase-admin.ts`'s `preferRest: true` setting already covers this (same admin instance), confirm a real authenticated write/read against Firestore succeeds for a design record
9. Existing test suite still passes (`node --test src/lib/*.test.mjs`)
10. `/plan` and `/chat` unaffected — quick smoke test both still work

Report checklist results when done. For #4 and #7 specifically, paste real output, not a description of what should happen.
