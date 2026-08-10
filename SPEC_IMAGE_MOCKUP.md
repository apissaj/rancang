Add real image generation for `/design` screen mockups on this existing Next.js app (PRD Forge), so the prototype canvas can show high-fidelity generated screen images instead of only schematic wireframe divs. This is additive — do not remove or break the existing wireframe rendering (`WireframeCanvas`/`ComponentBlock` in `src/components/design/wireframe-canvas.tsx`), it stays as the always-available clickable-navigation fallback/base layer.

## New env vars (already present in `.env`, already added to NAS deploy env — do not need to add them yourself, just consume via `process.env`)
```
IMAGE_GEN_BASE_URL=http://192.168.1.20:20128/v1
IMAGE_GEN_API_KEY=sk-...
IMAGE_GEN_MODEL=cx/gpt-5.5-image
```

## New lib helper (`src/lib/image-gen.ts`)
```ts
import "server-only";

export async function generateScreenImage(prompt: string): Promise<string> {
  const baseUrl = process.env.IMAGE_GEN_BASE_URL;
  const apiKey = process.env.IMAGE_GEN_API_KEY;
  const model = process.env.IMAGE_GEN_MODEL;
  if (!baseUrl || !model) throw new Error("Image generation is not configured");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image gateway error (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image gateway returned no image data");
  return `data:image/png;base64,${b64}`; // returned directly as a data URL, ready for an <img src>
}
```
Verified working (tested manually against the real gateway from the NAS host — confirm this still works from wherever the Next.js server actually runs at build/runtime; if the app server can't reach `192.168.1.20:20128` directly, note that in your report, don't silently swallow the error).

## New API route — `POST /api/design/image`
Body: `{ screen: Screen, designMd: string, styleHint?: string }` (styleHint optional, e.g. "flat vector illustration style, mobile app UI screenshot").
- Build an image-generation prompt from: (a) the screen's `name` and its `components` (list out labels/types briefly, e.g. "header: CompanyName, list-item: Danila Albarta - Owner, button: Next"), (b) key DESIGN.md tokens parsed from the front matter (extract colors.primary/secondary/tertiary/neutral, typography font family, rounded style) so the generated image's palette matches the token spec, (c) the screen's platform ("mobile" -> phone-shaped UI screenshot framing note, "web" -> desktop browser window framing note). Prompt should explicitly ask for "a high-fidelity mobile/web app UI screenshot mockup, NOT a wireframe, real polished UI design, [color palette from tokens], clean modern SaaS/app aesthetic, no photorealistic humans needed — abstract avatar circles with initials are fine, no readable brand logos" — keep it a single well-formed paragraph, not a bullet list (image models respond better to prose prompts).
- Call `generateScreenImage(prompt)`, return `NextResponse.json({ image: dataUrl })` on success.
- Handle/report errors clearly (502 with the upstream message) — this is best-effort enhancement, the wireframe already works without it, so don't let a failure here break anything else.
- This is a genuinely slow operation (image gen can take 20-60s+) — no special timeout handling needed beyond Next.js defaults, but do set `export const dynamic = "force-dynamic"` and a generous route segment config if Next.js needs one for long-running API routes on this version (check how `/api/design/route.ts` or `/api/plan/route.ts` already handle this, mirror it).

## Data model addition (`src/lib/storage.ts`)
Add an optional field to `Screen`:
```ts
export type Screen = { id: string; name: string; platform: "mobile" | "web"; components: ScreenComponent[]; generatedImage?: string /* data: URL, cached once generated so we don't regenerate on every view */ };
```
This is additive/optional — nothing that reads `Screen` today should break.

## UI — `WireframeCanvas` / prototype view (`src/components/design/wireframe-canvas.tsx` + `src/app/design/page.tsx`)
- Add a view-mode toggle above the canvas: **"Wireframe"** (existing schematic rendering, default) / **"Hi-fi mockup"** (new). Only show "Hi-fi mockup" as selectable once available for the current screen (i.e. it's a per-screen thing, not global — different screens may or may not have a generated image yet).
- When a screen has no `generatedImage` yet and the user switches to (or is already on) "Hi-fi mockup" mode, show a "Generate mockup image" button (with a small note like "may take up to a minute") instead of a blank state. Clicking it calls `/api/design/image`, shows a loading spinner over the device frame, and on success stores the returned data URL onto that screen's `generatedImage` field, persists it (update the active `DesignRecord`'s `screens` array — this does NOT need to create a new `DesignVersion`, just update the current version's `screens` in place and re-save via `designStore.save` + `sync.syncDesign`, since it's a rendering artifact not a content change) and displays the image inside the same device-frame wrapper (mobile phone frame / web browser frame) that wireframe mode uses, replacing the schematic content.
- If a screen ALREADY has `generatedImage`, "Hi-fi mockup" mode shows it immediately (no regenerate needed) with a small "Regenerate" button available to redo it (overwrites `generatedImage` for that screen, same persist-in-place, no new version).
- Click-navigation (onClick → next screen) is a wireframe-mode-only concept for this iteration — the hi-fi image is static (not clickable region by region); a "Back"/screen dropdown navigator stays visible above/around the image the same way it does in wireframe mode, so the user can still move between screens, just can't click inside the generated image itself. Note this limitation was accepted deliberately (real click-region-in-an-image would need vision-model click-mapping, out of scope) — don't try to build interactive hotspots on the image.
- Bulk option: a "Generate all screens" button (in the toolbar, near view-mode toggle) that sequentially (not all-parallel, to avoid hammering the gateway) generates hi-fi images for every screen in the current platform tab that doesn't have one yet, with a small progress indicator ("Generating 3/6..."). This is optional/nice-to-have — implement it only after the single-screen flow above works and is verified; skip it if it meaningfully complicates the diff, note the skip in your report.

## Constraints
- Do not touch `/plan`, `/chat`, `/api/plan`, `/api/chat`, `/api/design` (the DESIGN.md+screens JSON generation), AuthGate, or existing wireframe rendering logic — this is purely additive.
- Do not add new npm dependencies.
- `npm run build` must succeed with no Firebase env vars set, and separately with the real `.env` in this repo root (which now includes the `IMAGE_GEN_*` vars).
- Existing test suite must still pass.

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds both ways (no Firebase env / real `.env`)
2. TypeScript/ESLint clean
3. `/api/design/image` called for real (curl or via the running dev/start server) with a real screen + real designMd from a prior `/api/design` call — returns a real `data:image/png;base64,...` string, confirm by decoding a slice of it or checking response size is plausible (hundreds of KB, not a stub)
4. Wireframe mode (existing behavior) still renders and still navigates via click exactly as before — no regression
5. Hi-fi mockup mode: generate button works, image displays in the device frame, persists across a page reload (i.e. actually saved to the DesignRecord/localStorage, not just component state) — real test
6. Existing test suite still passes (`node --test src/lib/*.test.mjs`)
7. `/plan` and `/chat` unaffected — quick smoke check

Report checklist results when done. For #3 and #5 specifically, paste real evidence (response size, a truncated base64 prefix, or a description of what you visually confirmed via browser screenshot if you used one) — not a description of what should happen.
