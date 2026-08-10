# /design Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/design` route that turns a PRD or idea into a Google DESIGN.md spec + clickable wireframe prototype, following the exact patterns already used by `/plan` (storage, sync, edit route, versioning).

**Architecture:** New data types (`Screen`, `DesignVersion`, `DesignRecord`) added to `src/lib/storage.ts` alongside existing `planStore` pattern. Two non-streaming JSON API routes (`/api/design`, `/api/design/edit`) reuse `chatCompletion()` from `llm.ts`. Sync routes mirror `/api/sync/plans` exactly. UI page mirrors `/plan/page.tsx`'s form→preview→edit/version flow, plus a client-side wireframe renderer that parses YAML front matter with hand-rolled regex (no new deps) and renders screens as styled divs inside a device frame, with click-navigation between screens driven by local React state.

**Tech Stack:** Next.js 15 App Router, existing shadcn/ui primitives (select, textarea, checkbox, radio-group, button, card), no new npm packages.

---

## File Structure

- Modify: `src/lib/storage.ts` — add `ScreenComponent`, `Screen`, `DesignVersion`, `DesignRecord` types + `designStore`
- Create: `src/lib/design-yaml.ts` — hand-rolled YAML front-matter extractor + dotted-path token resolver, pure functions, unit-testable
- Create: `src/app/api/design/route.ts` — single-shot generate
- Create: `src/app/api/design/edit/route.ts` — AI edit
- Create: `src/app/api/sync/designs/route.ts` — GET/POST mirror of `sync/plans/route.ts`
- Create: `src/app/api/sync/designs/[id]/route.ts` — DELETE mirror
- Modify: `src/lib/use-sync.ts` — add `syncDesign`/`deleteDesignRemote`
- Create: `src/components/design/design-sidebar.tsx` — mirrors `plan-sidebar.tsx`
- Create: `src/components/design/wireframe-canvas.tsx` — renders one `Screen` inside a device frame using resolved tokens, handles click-navigation
- Create: `src/app/design/page.tsx` — the page (setup form + two-pane result view)
- Modify: `src/components/layout/top-nav.tsx` — add `/design` link
- Create: `src/lib/design-yaml.test.mjs` — self-check for the YAML extractor (mirrors `plan-versions.test.mjs` pattern: plain node, assert-based)

---

### Task 1: Storage types + designStore

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add types + store to storage.ts, right after `planStore`**

```ts
export type ScreenComponent = { type: string; label: string; onClick?: string };
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
  sourcePlanId?: string;
  platform: "mobile" | "web" | "both";
  pwa: boolean;
  designMd: string;
  screens: Screen[];
  createdAt: number;
  versions: DesignVersion[];
};

const DESIGN_LIMIT = 5;

function designKey() {
  return `prd-forge:${scope}:designs`;
}

export const designStore = {
  all: () => read<DesignRecord>(designKey()).sort((a, b) => b.createdAt - a.createdAt),
  save: (design: DesignRecord) => {
    const all = read<DesignRecord>(designKey()).filter((d) => d.id !== design.id);
    all.unshift(design);
    write(designKey(), all.slice(0, DESIGN_LIMIT));
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no new errors referencing storage.ts

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat(design): add Screen/DesignVersion/DesignRecord types + designStore"
```

---

### Task 2: YAML front-matter extractor (pure lib, TDD)

**Files:**
- Create: `src/lib/design-yaml.ts`
- Test: `src/lib/design-yaml.test.mjs`

DESIGN.md front matter is a constrained YAML subset: nested maps of `key: value` (2-space indent), values are quoted strings, bare numbers/units (`4px`), or `{colors.primary}` token refs. We only need: (1) extract the front-matter block, (2) parse it into a nested JS object, (3) resolve `{a.b}` refs to their target value.

- [ ] **Step 1: Write the test file**

```js
// Self-check for design-yaml.ts front-matter parsing. Run: node src/lib/design-yaml.test.mjs
import assert from "node:assert";

const { extractFrontMatter, resolveTokens } = await import("./design-yaml.ts").catch(async () => {
  console.log("SKIP: requires a TS-aware runtime (tsx/ts-node) to import design-yaml.ts directly.");
  process.exit(0);
});

const md = `---
version: alpha
name: Test Design
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
rounded:
  sm: 4px
  md: 8px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    rounded: "{rounded.sm}"
---
## Overview
Some body text.
`;

const parsed = extractFrontMatter(md);
assert.ok(parsed, "should extract front matter");
assert.strictEqual(parsed.name, "Test Design");
assert.strictEqual(parsed.colors.primary, "#1A1C1E");
assert.strictEqual(parsed.rounded.sm, "4px");

const resolved = resolveTokens(parsed);
assert.strictEqual(resolved.components["button-primary"].backgroundColor, "#1A1C1E");
assert.strictEqual(resolved.components["button-primary"].rounded, "4px");

const noFrontMatter = extractFrontMatter("# Just markdown, no front matter");
assert.strictEqual(noFrontMatter, null, "returns null when no front matter block present");

console.log("PASS: design-yaml front matter extraction + token resolution");
```

- [ ] **Step 2: Run test, verify it fails (module doesn't exist yet)**

Run: `cd /opt/data/tmp_prdforge9/work && node src/lib/design-yaml.test.mjs`
Expected: throws module-not-found, or SKIP if no TS runtime (tsx is not installed here — check first)

Run: `cd /opt/data/tmp_prdforge9/work && ls node_modules/.bin | grep tsx` — if absent, the test will SKIP gracefully like `plan-versions.test.mjs` does, which is fine and matches existing repo convention.

- [ ] **Step 3: Write design-yaml.ts**

```ts
/**
 * Minimal hand-rolled parser for the constrained YAML subset used by DESIGN.md
 * front matter: nested 2-space-indented maps, scalar values only (quoted
 * strings, bare numbers/units, {dotted.token} refs). No lists, no anchors.
 * Deliberately not a general YAML parser — ponytail: if DESIGN.md ever needs
 * arrays/lists in front matter, swap in `js-yaml` (already resolvable via npm,
 * not currently a dependency).
 */

type YamlValue = string | number | boolean | { [key: string]: YamlValue };

function parseScalar(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (/^".*"$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^'.*'$/.test(trimmed)) return trimmed.slice(1, -1);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed; // bare strings, e.g. "4px", "{colors.primary}"
}

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

/** Parses a block of `key: value` / nested-map lines into a nested object. */
function parseBlock(lines: string[]): Record<string, YamlValue> {
  const root: Record<string, YamlValue> = {};
  const stack: { indent: number; obj: Record<string, YamlValue> }[] = [{ indent: -1, obj: root }];

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const indent = indentOf(rawLine);
    const line = rawLine.trim();
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const valuePart = line.slice(colonIdx + 1).trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    const parent = stack[stack.length - 1].obj;

    if (valuePart === "") {
      // Could be a nested map (next lines more indented) OR an inline `{ a: 1, b: 2 }` map.
      const child: Record<string, YamlValue> = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else if (/^\{.*\}$/.test(valuePart)) {
      // Inline map: { fontFamily: "...", fontSize: "3rem" }
      const inner = valuePart.slice(1, -1);
      const child: Record<string, YamlValue> = {};
      for (const pair of splitTopLevelCommas(inner)) {
        const c = pair.indexOf(":");
        if (c === -1) continue;
        child[pair.slice(0, c).trim()] = parseScalar(pair.slice(c + 1).trim());
      }
      parent[key] = child;
    } else {
      parent[key] = parseScalar(valuePart);
    }
  }
  return root;
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Extracts and parses the `---\n...\n---` front-matter block. Returns null if absent. */
export function extractFrontMatter(markdown: string): Record<string, YamlValue> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  return parseBlock(match[1].split("\n"));
}

function getPath(obj: Record<string, YamlValue>, path: string): YamlValue | undefined {
  return path.split(".").reduce<YamlValue | undefined>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) return (acc as Record<string, YamlValue>)[key];
    return undefined;
  }, obj);
}

/** Recursively replaces `{a.b.c}` string values with the resolved value at that path. */
export function resolveTokens(root: Record<string, YamlValue>): Record<string, YamlValue> {
  function resolveValue(v: YamlValue): YamlValue {
    if (typeof v === "string") {
      const m = v.match(/^\{([\w.-]+)\}$/);
      if (m) {
        const resolved = getPath(root, m[1]);
        if (resolved !== undefined) return resolveValue(resolved);
      }
      return v;
    }
    if (v && typeof v === "object") {
      const out: Record<string, YamlValue> = {};
      for (const [k, val] of Object.entries(v)) out[k] = resolveValue(val);
      return out;
    }
    return v;
  }
  return resolveValue(root) as Record<string, YamlValue>;
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `cd /opt/data/tmp_prdforge9/work && node src/lib/design-yaml.test.mjs`
Expected: `PASS: design-yaml front matter extraction + token resolution` (or SKIP message if no TS runtime — acceptable, matches existing test convention)

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-yaml.ts src/lib/design-yaml.test.mjs
git commit -m "feat(design): hand-rolled YAML front-matter extractor + token resolver"
```

---

### Task 3: `/api/design` route (single-shot generate)

**Files:**
- Create: `src/app/api/design/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { Screen } from "@/lib/storage";

export const dynamic = "force-dynamic";

type DesignResponse = { designMd: string; screens: Screen[] };

const SYSTEM_PROMPT = `You are a senior product designer producing a DESIGN.md design-token spec plus a
clickable wireframe prototype, given an app idea (and optionally its full PRD for context).

Output ONLY valid JSON, no markdown code fences, no commentary, matching exactly this shape:
{
  "designMd": "<the full DESIGN.md file content as a single string>",
  "screens": [ { "id": "...", "name": "...", "platform": "mobile" | "web", "components": [ { "type": "...", "label": "...", "onClick": "target-screen-id" } ] } ]
}

designMd MUST be Google's open DESIGN.md format: YAML front matter followed by a Markdown body with
EXACTLY these "## " headings, in this order: Overview, Colors, Typography, Layout, Elevation & Depth,
Shapes, Components, Do's and Don'ts.

Front matter rules:
- version: alpha
- name: <design name>, description: <one line>
- colors: primary, secondary, tertiary, neutral as quoted hex strings, e.g. "#1A1C1E"
- typography: named styles (h1, h2, body-md, etc.) each an inline map: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- rounded: sm/md/lg px values
- spacing: sm/md/lg px values
- components: named component tokens (e.g. button-primary) as nested maps referencing other tokens with
  "{colors.primary}" dotted-path syntax; hover/active variants are separate SIBLING keys like
  button-primary-hover, never nested inside the base component.

In the "## Layout" section, note responsive breakpoints if platform is "both". If pwa is true, add
manifest/service-worker/installable guidance to "## Overview" or "## Do's and Don'ts".

screens: produce 4-8 screens covering the idea's core user flows, each with 5-10 components using ONLY
these types: header, text, button, input, list-item, card, nav-item, image-placeholder, divider.
Components that navigate to another screen MUST set "onClick" to that screen's "id". If platform is
"both", generate the SAME logical screens twice: once with platform:"mobile" and ids like "home-mobile",
once with platform:"web" and ids like "home-web" — each set's onClick targets must point only within its
own platform's ids. If platform is "mobile" or "web" only, generate just that platform's screens.

Output only the JSON object.`;

/** Strip markdown code fences models sometimes wrap JSON in despite instructions. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidDesignResponse(v: unknown): v is DesignResponse {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.designMd !== "string" || !r.designMd.trim()) return false;
  if (!Array.isArray(r.screens) || r.screens.length === 0) return false;
  return r.screens.every((s: unknown) => {
    if (!s || typeof s !== "object") return false;
    const ss = s as Record<string, unknown>;
    return (
      typeof ss.id === "string" &&
      typeof ss.name === "string" &&
      (ss.platform === "mobile" || ss.platform === "web") &&
      Array.isArray(ss.components)
    );
  });
}

function buildUserMessage(idea: string, planMarkdown: string | undefined, vibe: string | undefined, platform: string, pwa: boolean): string {
  const lines = [`Idea: ${idea}`, `Platform: ${platform}`, `PWA: ${pwa}`];
  if (vibe?.trim()) lines.push(`Vibe: ${vibe}`);
  if (planMarkdown?.trim()) lines.push(`\nFull PRD for context:\n---\n${planMarkdown}\n---`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const { idea, planMarkdown, vibe, platform, pwa } = (await req.json()) as {
    idea: string;
    planMarkdown?: string;
    vibe?: string;
    platform: "mobile" | "web" | "both";
    pwa: boolean;
  };

  if (!idea || !idea.trim()) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }
  if (platform !== "mobile" && platform !== "web" && platform !== "both") {
    return NextResponse.json({ error: "platform must be mobile, web, or both" }, { status: 400 });
  }

  try {
    const raw = await chatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(idea, planMarkdown, vibe, platform, !!pwa) },
    ]);
    const parsed = parseJsonLoose(raw);
    if (!isValidDesignResponse(parsed)) {
      throw new Error("Model returned malformed design JSON");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors in this file

- [ ] **Step 3: Commit**

```bash
git add src/app/api/design/route.ts
git commit -m "feat(design): add POST /api/design single-shot generate route"
```

---

### Task 4: `/api/design/edit` route (AI edit)

**Files:**
- Create: `src/app/api/design/edit/route.ts`

- [ ] **Step 1: Write the route** (same JSON pattern as Task 3, different prompt/body shape)

```ts
import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { Screen } from "@/lib/storage";

export const dynamic = "force-dynamic";

type DesignResponse = { designMd: string; screens: Screen[] };

const SYSTEM_PROMPT = `You are revising an existing DESIGN.md + screen wireframe set based on the user's
instruction. Return the COMPLETE updated JSON in the same shape as given, not a diff or partial excerpt,
no preamble/commentary. Preserve the Google DESIGN.md format (YAML front matter + the 8 canonical "## "
sections: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts)
and the screens' id/onClick linking unless the instruction asks to change them.

Output ONLY valid JSON, no markdown code fences, matching exactly:
{ "designMd": "...", "screens": [ { "id": "...", "name": "...", "platform": "mobile" | "web", "components": [ { "type": "...", "label": "...", "onClick": "..." } ] } ] }`;

/** Strip markdown code fences models sometimes wrap JSON in despite instructions. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidDesignResponse(v: unknown): v is DesignResponse {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.designMd !== "string" || !r.designMd.trim()) return false;
  if (!Array.isArray(r.screens) || r.screens.length === 0) return false;
  return r.screens.every((s: unknown) => {
    if (!s || typeof s !== "object") return false;
    const ss = s as Record<string, unknown>;
    return typeof ss.id === "string" && typeof ss.name === "string" && Array.isArray(ss.components);
  });
}

function buildUserMessage(designMd: string, screens: Screen[], instruction: string): string {
  return `Current DESIGN.md:\n---\n${designMd}\n---\n\nCurrent screens JSON:\n${JSON.stringify(screens)}\n\nInstruction:\n${instruction}`;
}

export async function POST(req: Request) {
  const { designMd, screens, instruction } = (await req.json()) as {
    designMd: string;
    screens: Screen[];
    instruction: string;
  };

  if (!designMd || !designMd.trim()) {
    return NextResponse.json({ error: "designMd is required" }, { status: 400 });
  }
  if (!instruction || !instruction.trim()) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  try {
    const raw = await chatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(designMd, screens ?? [], instruction) },
    ]);
    const parsed = parseJsonLoose(raw);
    if (!isValidDesignResponse(parsed)) {
      throw new Error("Model returned malformed design JSON");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/design/edit/route.ts
git commit -m "feat(design): add POST /api/design/edit AI-revision route"
```

---

### Task 5: Sync routes for designs

**Files:**
- Create: `src/app/api/sync/designs/route.ts`
- Create: `src/app/api/sync/designs/[id]/route.ts`

- [ ] **Step 1: Write `route.ts`** (exact mirror of `sync/plans/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import type { DesignRecord } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("designs").get();
  const designs = snap.docs.map((d) => d.data() as DesignRecord);
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const design = (await req.json()) as DesignRecord;
  if (!design?.id) {
    return NextResponse.json({ error: "Missing design.id" }, { status: 400 });
  }
  await getAdminDb().collection("users").doc(check.uid).collection("designs").doc(design.id).set(design);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write `[id]/route.ts`** (exact mirror of `sync/plans/[id]/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const { id } = await params;
  await getAdminDb().collection("users").doc(check.uid).collection("designs").doc(id).delete();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sync/designs
git commit -m "feat(design): add sync routes for designs (mirrors sync/plans)"
```

---

### Task 6: Wire designs into `use-sync.ts`

**Files:**
- Modify: `src/lib/use-sync.ts`

- [ ] **Step 1: Import designStore/DesignRecord, add migration push, merge-on-load, syncDesign, deleteDesignRemote**

```ts
import { conversationStore, planStore, designStore, type Conversation, type PlanRecord, type DesignRecord } from "@/lib/storage";
```

In the migration block, add design push alongside chats/plans:

```ts
        if (!migrated.current) {
          migrated.current = true;
          const localChats = conversationStore.all();
          const localPlans = planStore.all();
          const localDesigns = designStore.all();
          await Promise.all([
            ...localChats.map((c) => authedFetch(user, "/api/sync/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) })),
            ...localPlans.map((p) => authedFetch(user, "/api/sync/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })),
            ...localDesigns.map((d) => authedFetch(user, "/api/sync/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) })),
          ]);
        }
```

Add a designs fetch to the merge Promise.all and merge block:

```ts
        const [chatsRes, plansRes, designsRes] = await Promise.all([
          authedFetch(user, "/api/sync/chats"),
          authedFetch(user, "/api/sync/plans"),
          authedFetch(user, "/api/sync/designs"),
        ]);
```

```ts
        if (designsRes.ok) {
          const { designs } = (await designsRes.json()) as { designs: DesignRecord[] };
          for (const remote of designs) {
            const local = designStore.all().find((d) => d.id === remote.id);
            if (!local || remote.createdAt >= local.createdAt) designStore.save(remote);
          }
        }
```

Add `syncDesign` next to `syncPlan`:

```ts
  const syncDesign = async (design: DesignRecord) => {
    if (!user) return;
    setStatus("syncing");
    try {
      const res = await authedFetch(user, "/api/sync/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      setStatus(res.ok ? "synced" : "idle");
    } catch (err) {
      console.warn("[sync] design sync failed", err);
      setStatus("idle");
    }
  };
```

Add `deleteDesignRemote` next to `deleteConversation`:

```ts
  const deleteDesignRemote = async (id: string) => {
    if (!user) return;
    try {
      await authedFetch(user, `/api/sync/designs/${id}`, { method: "DELETE" });
    } catch (err) {
      console.warn("[sync] design delete failed", err);
    }
  };
```

Update the return statement:

```ts
  return { status, syncConversation, syncPlan, syncDesign, deleteConversation, deleteDesignRemote, active: !!user };
```

- [ ] **Step 2: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-sync.ts
git commit -m "feat(design): wire designStore into useSync (migration/merge/syncDesign)"
```

---

### Task 7: Design sidebar component

**Files:**
- Create: `src/components/design/design-sidebar.tsx`

- [ ] **Step 1: Write it** (exact mirror of `plan-sidebar.tsx`, swap types/copy)

```tsx
"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DesignRecord } from "@/lib/storage";

export function DesignSidebar({
  designs,
  activeId,
  onSelect,
}: {
  designs: DesignRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-full shrink-0 border-b bg-muted/20 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Recent Designs
      </div>
      <ScrollArea className="h-40 lg:h-[calc(100%-2rem)]">
        <div className="flex flex-col gap-1 px-2 pb-2 lg:flex-col">
          {designs.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                d.id === activeId && "bg-accent"
              )}
              title={d.title}
            >
              {d.title}
            </button>
          ))}
          {designs.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No designs yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/design/design-sidebar.tsx
git commit -m "feat(design): add DesignSidebar component"
```

---

### Task 8: Wireframe canvas component

**Files:**
- Create: `src/components/design/wireframe-canvas.tsx`

This renders one `Screen` inside a device frame, using resolved tokens from `resolveTokens(extractFrontMatter(designMd))`. Click-navigation is handled by the parent via `onNavigate(screenId)` callback — this component is presentational/stateless re: which screen is active.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { AlignJustify, Image as ImageIcon } from "lucide-react";
import type { Screen, ScreenComponent } from "@/lib/storage";

type Tokens = {
  colors?: { primary?: string; secondary?: string; tertiary?: string; neutral?: string };
  rounded?: { sm?: string; md?: string; lg?: string };
  spacing?: { sm?: string; md?: string; lg?: string };
};

function ComponentBlock({ c, tokens, onNavigate }: { c: ScreenComponent; tokens: Tokens; onNavigate: (id: string) => void }) {
  const primary = tokens.colors?.primary ?? "#1A1C1E";
  const secondary = tokens.colors?.secondary ?? "#6C7278";
  const tertiary = tokens.colors?.tertiary ?? "#B8422E";
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const roundedSm = tokens.rounded?.sm ?? "4px";
  const spacingSm = tokens.spacing?.sm ?? "8px";

  const clickable = !!c.onClick;
  const handleClick = clickable ? () => onNavigate(c.onClick!) : undefined;

  switch (c.type) {
    case "header":
      return (
        <div style={{ color: primary, fontWeight: 700, fontSize: "1.5rem", padding: `${spacingSm} 0` }}>
          {c.label}
        </div>
      );
    case "text":
      return <p style={{ color: secondary, fontSize: "0.9rem" }}>{c.label}</p>;
    case "button":
      return (
        <button
          onClick={handleClick}
          style={{ backgroundColor: tertiary, color: "#fff", borderRadius: roundedSm, padding: `${spacingSm} 16px`, fontWeight: 600, border: "none", cursor: clickable ? "pointer" : "default", width: "100%" }}
        >
          {c.label}
        </button>
      );
    case "input":
      return (
        <div style={{ border: `1px solid ${secondary}`, borderRadius: roundedSm, padding: spacingSm, color: secondary, fontSize: "0.85rem" }}>
          {c.label}
        </div>
      );
    case "list-item":
      return (
        <button
          onClick={handleClick}
          style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${neutral}`, padding: `${spacingSm} 0`, width: "100%", background: "none", border: "none", textAlign: "left", cursor: clickable ? "pointer" : "default", color: primary }}
        >
          <AlignJustify className="h-3.5 w-3.5 shrink-0" style={{ color: secondary }} />
          {c.label}
        </button>
      );
    case "card":
      return (
        <div onClick={handleClick} style={{ border: `1px solid ${secondary}33`, borderRadius: roundedSm, padding: spacingSm, cursor: clickable ? "pointer" : "default", color: primary }}>
          {c.label}
        </div>
      );
    case "nav-item":
      return (
        <button
          onClick={handleClick}
          style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.75rem", background: neutral, color: primary, border: "none", cursor: clickable ? "pointer" : "default" }}
        >
          {c.label}
        </button>
      );
    case "image-placeholder":
      return (
        <div style={{ background: neutral, borderRadius: roundedSm, height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: secondary }}>
          <ImageIcon className="h-5 w-5" />
        </div>
      );
    case "divider":
      return <hr style={{ borderColor: neutral }} />;
    default:
      return <div style={{ color: secondary, fontSize: "0.8rem" }}>{c.label}</div>;
  }
}

export function WireframeCanvas({
  screen,
  designMd,
  pwa,
  onNavigate,
}: {
  screen: Screen;
  designMd: string;
  pwa: boolean;
  onNavigate: (id: string) => void;
}) {
  const tokens = resolveDesignTokens(designMd);
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const isMobile = screen.platform === "mobile";

  return (
    <div
      className="mx-auto flex flex-col overflow-hidden rounded-2xl border shadow-md"
      style={{
        width: isMobile ? 375 : "100%",
        maxWidth: isMobile ? 375 : 640,
        background: neutral,
      }}
    >
      {isMobile && pwa && (
        <div className="flex items-center gap-1 border-b bg-black/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          <span className="text-[10px] opacity-60">Installed app</span>
        </div>
      )}
      <div className="flex flex-col gap-3 overflow-auto p-4" style={{ minHeight: isMobile ? 560 : 400 }}>
        {screen.components.map((c, i) => (
          <ComponentBlock key={i} c={c} tokens={tokens} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

// Re-exported for the page to reuse without re-parsing per component.
export { resolveDesignTokens };

function resolveDesignTokens(designMd: string): Tokens {
  // Lazy import avoided; direct sync require would need it exported from design-yaml.
  return _resolveDesignTokens(designMd);
}

import { extractFrontMatter, resolveTokens } from "@/lib/design-yaml";

function _resolveDesignTokens(designMd: string): Tokens {
  const front = extractFrontMatter(designMd);
  if (!front) return {};
  return resolveTokens(front) as unknown as Tokens;
}
```

(Note: the `export { resolveDesignTokens}` before its declaration/the `_resolveDesignTokens` indirection is unnecessary — simplify: just define `resolveDesignTokens` once at module scope using the import at top, no double-export. Fix in the actual file: put the `import` at the top of the file, and define `function resolveDesignTokens(designMd: string): Tokens { const front = extractFrontMatter(designMd); if (!front) return {}; return resolveTokens(front) as unknown as Tokens; }` once, export it directly with `export function`.)

- [ ] **Step 2: Type-check**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors (fix the import-order issue from the note above while writing the real file)

- [ ] **Step 3: Commit**

```bash
git add src/components/design/wireframe-canvas.tsx
git commit -m "feat(design): add WireframeCanvas component (token-driven screen renderer)"
```

---

### Task 9: `/design` page — setup form + generate

**Files:**
- Create: `src/app/design/page.tsx`

- [ ] **Step 1: Write the setup-form half of the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Check, Copy, Download, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { DesignSidebar } from "@/components/design/design-sidebar";
import { WireframeCanvas } from "@/components/design/wireframe-canvas";
import { designStore, planStore, type DesignRecord, type DesignVersion, type Screen } from "@/lib/storage";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

type Platform = "mobile" | "web" | "both";

export default function DesignPage() {
  const [idea, setIdea] = useState("");
  const [sourcePlanId, setSourcePlanId] = useState<string>("none");
  const [vibe, setVibe] = useState("");
  const [platform, setPlatform] = useState<Platform>("mobile");
  const [pwa, setPwa] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  const [designMd, setDesignMd] = useState("");
  const [screens, setScreens] = useState<Screen[]>([]);

  const sync = useSync();
  const { storageVersion } = useAuth();
  const plans = planStore.all();

  useEffect(() => {
    setDesigns(designStore.all());
    setActiveId(null);
    setIdea("");
    setDesignMd("");
    setScreens([]);
    setError(null);
    setShowSetup(true);
  }, [storageVersion]);

  useEffect(() => {
    if (sync.status === "synced") setDesigns(designStore.all());
  }, [sync.status]);

  const activeDesign = activeId ? designs.find((d) => d.id === activeId) ?? null : null;

  const generate = async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);
    const planMarkdown = sourcePlanId !== "none" ? plans.find((p) => p.id === sourcePlanId)?.markdown : undefined;
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, planMarkdown, vibe: vibe || undefined, platform, pwa }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Generation failed" }))).error ?? "Generation failed");
      const data = (await res.json()) as { designMd: string; screens: Screen[] };
      const now = Date.now();
      const record: DesignRecord = {
        id: nanoid(),
        title: idea.slice(0, 60),
        sourceIdea: idea,
        sourcePlanId: sourcePlanId !== "none" ? sourcePlanId : undefined,
        platform,
        pwa,
        designMd: data.designMd,
        screens: data.screens,
        createdAt: now,
        versions: [{ id: nanoid(), designMd: data.designMd, screens: data.screens, createdAt: now, source: "generated" }],
      };
      designStore.save(record);
      setDesigns(designStore.all());
      setActiveId(record.id);
      setDesignMd(record.designMd);
      setScreens(record.screens);
      setShowSetup(false);
      sync.syncDesign(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const loadDesign = (id: string) => {
    const d = designs.find((x) => x.id === id);
    if (!d) return;
    setActiveId(id);
    setIdea(d.sourceIdea);
    setSourcePlanId(d.sourcePlanId ?? "none");
    setPlatform(d.platform);
    setPwa(d.pwa);
    setDesignMd(d.designMd);
    setScreens(d.screens);
    setError(null);
    setShowSetup(false);
  };

  return (
    <AuthGate>
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex flex-col">
          <DesignSidebar designs={designs} activeId={activeId} onSelect={loadDesign} />
          <SyncIndicator status={sync.status} active={sync.active} />
        </div>

        {showSetup ? (
          <SetupForm
            idea={idea}
            setIdea={setIdea}
            sourcePlanId={sourcePlanId}
            setSourcePlanId={setSourcePlanId}
            plans={plans}
            vibe={vibe}
            setVibe={setVibe}
            platform={platform}
            setPlatform={setPlatform}
            pwa={pwa}
            setPwa={setPwa}
            loading={loading}
            error={error}
            onGenerate={generate}
            hasResult={!!activeDesign}
            onBackToResult={() => setShowSetup(false)}
          />
        ) : (
          <ResultView
            idea={idea}
            vibe={vibe}
            platform={platform}
            pwa={pwa}
            designMd={designMd}
            setDesignMd={setDesignMd}
            screens={screens}
            setScreens={setScreens}
            activeDesign={activeDesign}
            setDesigns={setDesigns}
            sync={sync}
            onEditSetup={() => setShowSetup(true)}
          />
        )}
      </div>
    </AuthGate>
  );
}
```

- [ ] **Step 2: Write `SetupForm` in the same file, below `DesignPage`**

```tsx
function SetupForm({
  idea,
  setIdea,
  sourcePlanId,
  setSourcePlanId,
  plans,
  vibe,
  setVibe,
  platform,
  setPlatform,
  pwa,
  setPwa,
  loading,
  error,
  onGenerate,
  hasResult,
  onBackToResult,
}: {
  idea: string;
  setIdea: (v: string) => void;
  sourcePlanId: string;
  setSourcePlanId: (v: string) => void;
  plans: { id: string; title: string; markdown: string }[];
  vibe: string;
  setVibe: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  pwa: boolean;
  setPwa: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  hasResult: boolean;
  onBackToResult: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {hasResult && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={onBackToResult}>
            <ChevronLeft className="h-4 w-4" /> Back to prototype
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold">Turn an idea into a design</h1>
          <p className="text-sm text-muted-foreground">
            Generates a DESIGN.md token spec plus a clickable wireframe prototype.
          </p>
        </div>

        {plans.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Start from an existing PRD (optional)</Label>
            <Select value={sourcePlanId} onValueChange={(v) => v && setSourcePlanId(v)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (write idea manually)</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Idea</Label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder='e.g. "A habit tracker app where users log daily habits and see streaks"'
            className="min-h-[120px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Vibe (optional)</Label>
          <Input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="e.g. playful, pastel — or corporate, dark, minimal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Platform</Label>
          <RadioGroup value={platform} onValueChange={(v) => v && setPlatform(v as Platform)} className="flex gap-4">
            {(["mobile", "web", "both"] as const).map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                <RadioGroupItem value={p} /> {p}
              </label>
            ))}
          </RadioGroup>
        </div>

        {platform !== "web" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={pwa} onCheckedChange={(v) => setPwa(!!v)} />
            Progressive Web App (installable)
          </label>
        )}

        <Button onClick={onGenerate} disabled={loading || !idea.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Designing..." : "Generate Design"}
        </Button>
        {loading && <p className="text-xs text-muted-foreground">This can take 10-30s.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check** (will still fail — `ResultView` referenced but not yet defined; that's Task 10)

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: error "Cannot find name 'ResultView'" — expected at this point, resolved by Task 10

- [ ] **Step 4: Commit** (commit as WIP since ResultView comes next task; acceptable since plan tasks are meant to be committed atomically but this file spans two tasks — combine Tasks 9+10 into one commit instead)

Skip commit here; commit once at the end of Task 10 with both halves of the file.

---

### Task 10: `/design` page — result view (prototype canvas + DESIGN.md pane)

**Files:**
- Modify: `src/app/design/page.tsx` (append `ResultView` + helpers)

- [ ] **Step 1: Append `ResultView` to the bottom of `src/app/design/page.tsx`**

```tsx
function ResultView({
  idea,
  vibe,
  platform,
  pwa,
  designMd,
  setDesignMd,
  screens,
  setScreens,
  activeDesign,
  setDesigns,
  sync,
  onEditSetup,
}: {
  idea: string;
  vibe: string;
  platform: Platform;
  pwa: boolean;
  designMd: string;
  setDesignMd: (v: string) => void;
  screens: Screen[];
  setScreens: (v: Screen[]) => void;
  activeDesign: DesignRecord | null;
  setDesigns: (v: DesignRecord[]) => void;
  sync: ReturnType<typeof useSync>;
  onEditSetup: () => void;
}) {
  const platforms: ("mobile" | "web")[] = platform === "both" ? ["mobile", "web"] : [platform];
  const [activeTab, setActiveTab] = useState<"mobile" | "web">(platforms[0]);
  const [currentScreenId, setCurrentScreenId] = useState<{ mobile?: string; web?: string }>({});
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);

  const tabScreens = screens.filter((s) => s.platform === activeTab);
  const currentId = currentScreenId[activeTab] ?? tabScreens[0]?.id;
  const currentScreen = tabScreens.find((s) => s.id === currentId) ?? tabScreens[0];
  const currentIndex = tabScreens.findIndex((s) => s.id === currentScreen?.id);

  const navigate = (id: string) => {
    if (tabScreens.some((s) => s.id === id)) {
      setCurrentScreenId((prev) => ({ ...prev, [activeTab]: id }));
    }
  };

  const versions = activeDesign?.versions ?? [];
  const viewedVersion = viewingVersionId ? versions.find((v) => v.id === viewingVersionId) ?? null : null;
  const displayedMd = viewedVersion ? viewedVersion.designMd : designMd;

  const persistNewVersion = (version: DesignVersion) => {
    if (!activeDesign) return;
    const updated: DesignRecord = {
      ...activeDesign,
      designMd: version.designMd,
      screens: version.screens,
      versions: [...activeDesign.versions, version],
    };
    designStore.save(updated);
    sync.syncDesign(updated);
    setDesigns(designStore.all());
    setDesignMd(updated.designMd);
    setScreens(updated.screens);
    setViewingVersionId(null);
    return updated;
  };

  const startEdit = () => {
    setEditDraft(designMd);
    setEditing(true);
  };

  const saveEdit = () => {
    persistNewVersion({ id: nanoid(), designMd: editDraft, screens, createdAt: Date.now(), source: "manual-edit" });
    setEditing(false);
  };

  const runAiEdit = async () => {
    if (!activeDesign || !aiInstruction.trim() || aiEditing) return;
    setAiEditing(true);
    setError(null);
    const instruction = aiInstruction;
    try {
      const res = await fetch("/api/design/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designMd, screens, instruction }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Edit failed" }))).error ?? "Edit failed");
      const data = (await res.json()) as { designMd: string; screens: Screen[] };
      persistNewVersion({ id: nanoid(), designMd: data.designMd, screens: data.screens, createdAt: Date.now(), source: "ai-edit", note: instruction });
      setAiInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiEditing(false);
    }
  };

  const restoreVersion = () => {
    if (!viewedVersion) return;
    persistNewVersion({
      id: nanoid(),
      designMd: viewedVersion.designMd,
      screens: viewedVersion.screens,
      createdAt: Date.now(),
      source: "manual-edit",
      note: `Restored from v${versions.findIndex((v) => v.id === viewedVersion.id) + 1}`,
    });
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(designMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([designMd], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "design.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const produce = () => {
    if (activeDesign) {
      const upToDate = activeDesign.designMd === designMd && JSON.stringify(activeDesign.screens) === JSON.stringify(screens);
      if (!upToDate) {
        const updated = { ...activeDesign, designMd, screens };
        designStore.save(updated);
        sync.syncDesign(updated);
        setDesigns(designStore.all());
      }
    }
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{idea.slice(0, 80)}</span>
          <span className="text-xs text-muted-foreground capitalize">
            · {platform}{pwa && platform !== "web" ? " · PWA" : ""}{vibe && ` · ${vibe}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEditSetup}>
            Edit setup
          </Button>
          <Button size="sm" onClick={produce}>
            {confirmed ? <Check className="h-3.5 w-3.5" /> : null}
            {confirmed ? "Ready — copy or download below" : "Produce DESIGN.md"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto lg:flex-row lg:overflow-hidden">
        <div className="flex flex-col gap-3 overflow-auto lg:w-1/2">
          {platform === "both" && (
            <div className="flex gap-1 rounded-lg border p-1 w-fit">
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${activeTab === p ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={currentIndex <= 0} onClick={() => navigate(tabScreens[currentIndex - 1]?.id)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <span className="text-muted-foreground">
              Screen: {currentIndex + 1}/{tabScreens.length}
            </span>
            <Select value={currentScreen?.id ?? ""} onValueChange={(v) => v && navigate(v)}>
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabScreens.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 items-start justify-center overflow-auto rounded-xl border bg-muted/10 p-6">
            {currentScreen && designMd && (
              <WireframeCanvas screen={currentScreen} designMd={designMd} pwa={pwa} onNavigate={navigate} />
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-1/2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <span className="text-sm font-medium">DESIGN.md</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeDesign && versions.length > 0 && !editing && (
                <Select value={viewingVersionId ?? "current"} onValueChange={(v) => setViewingVersionId(v === "current" ? null : v)}>
                  <SelectTrigger className="h-8 w-44">
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
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Edit
                </Button>
              )}
              {editing && (
                <>
                  <Button size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={copyMarkdown}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                <Download className="h-3.5 w-3.5" /> Download .md
              </Button>
            </div>
          </div>

          {!editing && activeDesign && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
              <input
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Make it darker / Add a settings screen / Use rounder corners"
                className="h-8 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={aiEditing}
              />
              <Button size="sm" onClick={runAiEdit} disabled={aiEditing || !aiInstruction.trim()}>
                {aiEditing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {aiEditing ? "Revising..." : "Revise"}
              </Button>
            </div>
          )}
          {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}
          {viewedVersion && (
            <div className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm">
              <span>Viewing v{versions.findIndex((v) => v.id === viewedVersion.id) + 1} (not current)</span>
              <Button size="sm" variant="outline" onClick={restoreVersion}>
                Restore this version
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {editing ? (
              <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="h-full min-h-[300px] resize-none font-mono text-xs" />
            ) : (
              <Markdown content={displayedMd} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function versionLabel(v: DesignVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Generated" : v.source === "manual-edit" ? "Manual edit" : "AI edit";
  return `v${index + 1} · ${sourceLabel}`;
}
```

- [ ] **Step 2: Type-check whole file**

Run: `cd /opt/data/tmp_prdforge9/work && npx tsc --noEmit`
Expected: no errors. Fix any prop-typing mismatches between `SetupForm`/`ResultView`/`DesignPage` found here.

- [ ] **Step 3: Lint**

Run: `cd /opt/data/tmp_prdforge9/work && npm run lint`
Expected: no errors in `src/app/design/page.tsx` or other new files

- [ ] **Step 4: Commit**

```bash
git add src/app/design/page.tsx
git commit -m "feat(design): add /design page (setup form + prototype/DESIGN.md result view)"
```

---

### Task 11: Nav link + full build verification

**Files:**
- Modify: `src/components/layout/top-nav.tsx`

- [ ] **Step 1: Add the link**

```ts
const links = [
  { href: "/chat", label: "Chat" },
  { href: "/plan", label: "Plan" },
  { href: "/design", label: "Design" },
];
```

- [ ] **Step 2: Full local test suite**

Run: `cd /opt/data/tmp_prdforge9/work && node --test src/lib/*.test.mjs`
Expected: all PASS (or SKIP for TS-runtime-dependent ones, matching existing behavior)

- [ ] **Step 3: Build with no Firebase env vars**

Run: `cd /opt/data/tmp_prdforge9/work && mv .env .env.bak 2>/dev/null; npm run build; mv .env.bak .env 2>/dev/null`
Expected: build succeeds (sync routes degrade to 503 at runtime, not build time — same as existing plan/chat sync routes)

- [ ] **Step 4: Build with real Firebase env vars**

Run: `cd /opt/data/tmp_prdforge9/work && npm run build`
Expected: build succeeds (`.env` already present with real creds)

- [ ] **Step 5: Lint whole repo**

Run: `cd /opt/data/tmp_prdforge9/work && npm run lint`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/top-nav.tsx
git commit -m "feat(design): add /design link to top nav"
```

---

### Task 12: Manual/live verification (dev server)

No new files. This task runs the deliverables checklist from SPEC_DESIGN.md against a live dev server + real LLM + real Firestore.

- [ ] **Step 1: Start dev server**

Run: `cd /opt/data/tmp_prdforge9/work && npm run dev &` (background), wait for "Ready"

- [ ] **Step 2: Call `/api/design` directly with curl for idea "A habit tracker app", platform=both, pwa=true**

```bash
curl -s -X POST http://localhost:3000/api/design \
  -H "Content-Type: application/json" \
  -d '{"idea":"A habit tracker app","platform":"both","pwa":true}' | tee /tmp/design-response.json | head -c 2000
```

Expected: JSON with non-empty `designMd` containing `---` front matter and all 8 `## ` headings, `screens` array with both `"platform":"mobile"` and `"platform":"web"` entries, onClick ids matching sibling screen ids. Verify with:

```bash
node -e '
const d = require("/tmp/design-response.json");
console.log("sections:", ["Overview","Colors","Typography","Layout","Elevation & Depth","Shapes","Components","Do'\''s and Don'\''ts"].filter(h => d.designMd.includes("## " + h)));
console.log("mobile screens:", d.screens.filter(s=>s.platform==="mobile").map(s=>s.id));
console.log("web screens:", d.screens.filter(s=>s.platform==="web").map(s=>s.id));
'
```

- [ ] **Step 3: Call `/api/design/edit` with a real instruction against the generated response**

```bash
node -e '
const d = require("/tmp/design-response.json");
console.log(JSON.stringify({designMd: d.designMd, screens: d.screens, instruction: "Make the primary color a deep blue instead"}))
' > /tmp/edit-req.json
curl -s -X POST http://localhost:3000/api/design/edit -H "Content-Type: application/json" -d @/tmp/edit-req.json | tee /tmp/edit-response.json | head -c 1000
```

Expected: valid JSON, `designMd` colors.primary changed to a blue hex.

- [ ] **Step 4: Browser click-through of `/design`**

Manually (or via browser automation tool if available): navigate to `/design`, sign in, enter idea, platform=both, pwa=true, click Generate Design, wait for result, click a button/nav-item with a visible onClick target, confirm canvas navigates and breadcrumb "Screen: x/y" updates, switch Mobile/Web tab and confirm independent screen memory, manually edit DESIGN.md text and Save, confirm new version appears in dropdown, run one AI edit with a real instruction and confirm designMd changes, click "Produce DESIGN.md" and confirm confirmation state appears, copy/download buttons work.

- [ ] **Step 5: Confirm Firestore sync round-trip**

After signing in via the browser test above, check Firestore console or query via:

```bash
curl -s http://localhost:3000/api/sync/designs -H "Authorization: Bearer <idToken from browser devtools>" | head -c 500
```

Expected: `{"designs":[...]}` containing the design just created.

- [ ] **Step 6: Smoke-test `/plan` and `/chat` unaffected**

Manually load `/plan`, generate a PRD, confirm unchanged. Load `/chat`, send a message, confirm unchanged.

- [ ] **Step 7: Stop dev server, record results**

Compile findings for the deliverables checklist report (paste real `/api/design` and `/api/design/edit` output excerpts, confirm each of the 10 checklist items).

---

## Self-Review Notes

- **Spec coverage:** all SPEC_DESIGN.md sections mapped: storage types (Task 1), API routes (Tasks 3-4), sync (Tasks 5-6), sidebar (Task 7), canvas/device-frame/PWA-chrome (Task 8), setup form + platform/pwa/vibe/PRD-picker (Task 9), prototype navigation + tab switcher + DESIGN.md edit/AI-edit/version-history/produce button (Task 10), nav link (Task 11), verification against real LLM/Firestore (Task 12).
- **No new dependencies**: confirmed via `package.json` review — no `js-yaml` needed, hand-rolled parser suffices for the constrained front-matter subset.
- **DESIGN_LIMIT = 5** matches `PLAN_LIMIT` pattern exactly (Task 1).
- Task 8's inline note about `resolveDesignTokens` double-export is a drafting artifact to fix during Step 1 — flagged explicitly so the implementer doesn't copy the redundant indirection into the real file.
