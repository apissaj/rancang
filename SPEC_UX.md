Three UI/UX improvements to this existing Next.js app (PRD Forge). Do NOT touch the storage-scope isolation logic in storage.ts/auth-provider.tsx from the previous change — that must keep working exactly as-is.

## 1. Redesign: modern, clean, minimalist UI overhaul
- Keep dark theme default, shadcn/ui, Tailwind — just elevate the visual polish across the whole app (landing, chat, plan pages).
- Sign-in button: currently a plain ghost/ghost-outline button that's easy to miss. Make it a clearly bounded button — solid background or clear border/box, proper padding, visually stands out in the top nav (e.g. primary-colored button, not a bare text link).
- General visual pass: consistent spacing/padding, subtle borders/shadows on cards, better typography hierarchy (font sizes/weights), smoother hover/transition states on interactive elements, consistent border-radius across buttons/cards/inputs. Look at the existing landing page cards and top-nav as a baseline — refine, don't rebuild from scratch structurally.
- Keep all existing routes/functionality identical — this is a visual/styling pass, not a rewrite of logic.

## 2. Gate Chat and Plan behind login
- Both `/chat` and `/plan` now REQUIRE a logged-in user. Anonymous users hitting either route should see a clean "Sign in to continue" state (centered card/message with a prominent "Sign in with Google" button) INSTEAD of the chat/plan UI — not a redirect loop, not a blank page, not an error.
- This reverses the earlier requirement (anonymous access was previously required) — that's intentional, per explicit user instruction. Update accordingly: it's fine now to require `user` before rendering the actual chat/plan interface.
- The landing page `/` and its two cards linking to /chat and /plan stay accessible to everyone (no gate on the homepage itself) — the gate only kicks in on the /chat and /plan pages themselves.
- Since Chat/Plan now always require login, sync-to-Firestore is no longer an "if logged in" edge case — it's now the default behavior whenever those pages render at all. Anonymous-mode code paths in use-sync.ts / storage.ts can stay (harmless dead code for safety) but don't need new anonymous-specific UI on these two pages anymore.

## 3. Sign out should navigate to homepage
- Currently sign-out just calls Firebase signOut() and stays on the current page/route.
- After a successful sign-out, navigate to `/` (homepage) using Next.js router (`useRouter` from `next/navigation`, call `router.push("/")` after the signOut promise resolves). This matters most when a user signs out while on /chat or /plan (which are now gated) — they should land on the public homepage, not get stuck on a gated page they can no longer see.

## Constraints
- Do not break the Firestore sync logic, the storage-scope-per-uid isolation, or the LLM chat/plan API routes — those are unchanged, working, and tested.
- Do not add new dependencies unless truly necessary for the visual pass (prefer existing Tailwind/shadcn primitives already in the project).
- `npm run build` must still succeed with no Firebase env vars set (the gate should just show "Sign in to continue" permanently in that case, not crash).

## Deliverables checklist (verify yourself before reporting done)
1. `npm run build` succeeds with no Firebase env vars set, and separately with dummy Firebase env vars set
2. TypeScript/ESLint clean
3. Visiting /chat or /plan while logged out shows a "sign in to continue" gate, not the chat/plan UI, not an error, not a redirect loop
4. Visiting /chat or /plan while logged in shows the normal working chat/plan UI (existing behavior preserved)
5. Sign-in button is visually a clear bounded button (not a bare link) in the top nav
6. Clicking sign-out navigates to `/` afterward
7. Landing page `/` remains accessible with no login required
8. General visual polish is applied consistently across landing/chat/plan without breaking any existing interactive behavior (composer, comparison mode, PRD generation, copy/download, sidebars)

Report the checklist results when done, and flag anything you had to deviate from and why.
