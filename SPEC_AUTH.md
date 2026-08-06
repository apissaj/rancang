Add Firebase Google Authentication and Firestore-backed session sync to this existing Next.js app (PRD Forge). Two features, both optional/non-breaking for anonymous users:

## Feature A — Google Sign-In (Firebase Auth)
- Add `firebase` (client SDK) as a dependency
- Client-side Firebase init using this exact config (put in `src/lib/firebase-client.ts`, values from `NEXT_PUBLIC_FIREBASE_*` env vars, not hardcoded):
  ```
  apiKey: NEXT_PUBLIC_FIREBASE_API_KEY
  authDomain: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  projectId: NEXT_PUBLIC_FIREBASE_PROJECT_ID
  storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  messagingSenderId: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: NEXT_PUBLIC_FIREBASE_APP_ID
  ```
- Add a "Sign in with Google" button in the top nav (use `signInWithPopup` + `GoogleAuthProvider`). Show user's avatar/name + "Sign out" when logged in, show "Sign in" button when logged out.
- Auth state via a React context/provider (`src/components/auth-provider.tsx`) wrapping the app, exposing `{ user, loading, signIn, signOut }`.
- The app MUST remain fully usable with zero auth (anonymous users keep working exactly as today, using localStorage only — do not force login, do not gate /chat or /plan behind auth).

## Feature B — Firestore session sync (only for logged-in users)
- Add `firebase-admin` (server SDK) as a dependency, initialized server-side from a service account JSON via env var `FIREBASE_SERVICE_ACCOUNT_JSON` (the full JSON as a single-line string env var — parse it with `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)`). Put this in `src/lib/firebase-admin.ts`.
- Data model in Firestore (existing local types are `Conversation` and `PlanRecord` in `src/lib/storage.ts` — reuse the same shape):
  - `users/{uid}/chats/{chatId}` — same fields as `Conversation` (id, title, createdAt, messages[])
  - `users/{uid}/plans/{planId}` — same fields as `PlanRecord` (id, title, idea, markdown, createdAt)
- Server-side auth verification: every write-capable API route must verify the caller's Firebase ID token using `firebase-admin`'s `getAuth().verifyIdToken(token)` before touching Firestore. Client sends the token via `Authorization: Bearer <idToken>` header (get it from `user.getIdToken()`).
- New API routes:
  - `POST /api/sync/chats` — upsert a conversation for the authenticated user
  - `GET /api/sync/chats` — list the authenticated user's conversations
  - `DELETE /api/sync/chats/[id]` — delete one
  - Same three for `/api/sync/plans`
- Client sync behavior:
  - When a user is NOT logged in: behave exactly as today (localStorage only, via existing `src/lib/storage.ts` functions — do not change their signatures).
  - When a user logs in: (1) one-time migration — read whatever is currently in localStorage and push it to Firestore via the sync API (skip duplicates by id), (2) from then on, new chats/plans write to BOTH localStorage (fast local cache) AND Firestore (source of truth across devices), (3) on app load while logged in, merge Firestore data into the local view (Firestore wins on conflict by `createdAt`).
  - When a user logs out: keep using localStorage only again, do not clear it.
- Add a small "Syncing..." / "Synced" indicator near the sidebar when a Firestore write is in flight / just completed. Fail silently (console.warn, do not break the UI) if a sync call fails — localStorage must always remain the source of truth for the current session even if sync fails.

## Firestore Security Rules
Write `firestore.rules` in the repo root (I will paste this into the Firebase console manually — you don't need to deploy it):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Environment variables (update .env.example)
Add these to the existing `.env.example` (keep the existing `LLM_*` vars unchanged):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_JSON=
```

## Constraints
- Do NOT break any existing functionality (chat, comparison mode, plan generator must keep working exactly as before for anonymous users).
- Do NOT require auth anywhere — it's purely additive.
- Keep the existing dark theme / shadcn/ui visual style consistent for the new sign-in button and sync indicator.
- `npm run build` must succeed with NO Firebase env vars set (auth/sync features should just silently be unavailable/no-op at build time and at runtime if env vars are missing — do not crash the app).
- No new database besides Firestore — do not add MongoDB/Postgres/etc.

## Deliverables checklist (verify yourself before reporting done)
1. `npm install && npm run build` succeeds with no Firebase env vars set (must not crash)
2. `npm run build` also succeeds WITH dummy Firebase env vars set
3. TypeScript/ESLint clean, no errors blocking build
4. Anonymous flow (no login) still works identically to before — chat, comparison mode, plan generator
5. Firebase Admin SDK init doesn't throw if `FIREBASE_SERVICE_ACCOUNT_JSON` is malformed/missing — should log a warning and disable sync routes gracefully (return 503 with a clear message), not crash the whole app
6. `firestore.rules` file exists and matches the spec above
7. README updated with: how to get Firebase web config, how to get the service account JSON, and how to set the two new env var groups

Report the checklist results when done, and flag anything you had to deviate from and why.
