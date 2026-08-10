Add a real progress/status indicator for the image-generation flow just built on `/design` (Hi-fi mockup mode — `generateImage`/`generateAllForTab` in `src/app/design/page.tsx`, calling `/api/design/image`). Currently it's just a spinner + static "Generating..."/"Regenerating..." text. The image gateway call is a single non-streaming HTTP request that took ~58.8s in the last real test — there is NO real server-sent progress signal available (the gateway doesn't stream generation progress), so build an honest ESTIMATED progress experience, not a fabricated exact percentage.

## Approach
- Track elapsed time client-side with `setInterval` (every ~200-300ms) from the moment the fetch to `/api/design/image` starts.
- Show: (a) an elapsed time counter, e.g. "Generating... 12s", (b) a progress bar that advances toward but never reaches 100% while waiting — use a simple asymptotic curve driven by elapsed time against a known typical duration (~50s, based on the real 58.8s test run), e.g. `progress = 100 * (1 - Math.exp(-elapsedSeconds / 25))` which reaches ~85% around 45s and ~95% around 75s, never hitting 100 until the request actually resolves — this reads as "still working" honestly instead of a bar that fills then hangs at 100%. On success, snap the bar to 100% briefly (200-300ms) before showing the final image, so it doesn't feel like it silently completed.
- Show a short rotating status line under the bar, changing every ~4-6s through a fixed sequence so the user has something concrete to read while waiting (these are cosmetic stage labels, not real backend phases — keep them honest/vague, don't claim specific backend steps that don't exist): e.g. "Composing prompt from your design tokens...", "Rendering UI mockup...", "Finalizing image...", loop back if it runs long. Implement as an array indexed by `Math.floor(elapsed / 5) % labels.length`.
- Reuse the exact same progress UI component/logic for both the single-screen "Generate mockup image"/"Regenerate" button AND the "Generate all screens" bulk flow — in the bulk case, show per-item elapsed/progress for the currently-generating screen PLUS the existing "Generating N/M" overall counter (don't remove the N/M counter, add the per-item detail alongside it).
- Small inline component is fine (e.g. a `GenerationProgress` component in `wireframe-canvas.tsx` or inline in `design/page.tsx`, whichever fits the existing file split better) — no new dependencies, use existing shadcn `Progress` component if already present in this project (`src/components/ui/progress.tsx`), otherwise a plain styled div with a width percentage (check `components.json`/`src/components/ui/` first before adding a new shadcn component).

## Constraints
- Do not change the actual generation logic/timing/API calls — this is purely a UI/UX layer on top of the existing `generateImage`/`generateAllForTab` functions.
- Do not touch `/plan`, `/chat`, wireframe mode, or anything outside the hi-fi mockup generation UI.
- No new npm dependencies.
- `npm run build` must succeed (both no-Firebase-env and real `.env`).

## Deliverables checklist (verify before reporting done)
1. `npm run build` succeeds both ways
2. TypeScript/ESLint clean
3. Real test: trigger a real image generation, observe (via browser or by reading the component state/logs) that elapsed time increments and progress bar advances smoothly over the real ~50s+ duration, status label rotates, and it resolves to the actual image on completion — paste real evidence (elapsed seconds observed, progress values at a couple of timestamps, or a description of what you saw in a real browser test)
4. Bulk "Generate all screens" still shows the N/M counter AND the new per-item progress
5. Existing test suite still passes
6. No regression to wireframe mode or existing hi-fi mockup display/persist behavior

Report checklist results when done, with real evidence for #3.
