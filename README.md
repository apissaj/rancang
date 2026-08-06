# PRD Forge

Two AI tools in one app, no auth or database required:

- **`/chat`** — multi-model chat with an optional side-by-side comparison mode.
- **`/plan`** — turn a rough idea into a structured PRD (Markdown), streamed live.

Chat history and generated PRDs persist in your browser's `localStorage` by default. Nothing is stored server-side unless you enable optional Google Sign-In (see below), in which case logged-in users also get their history synced to Firestore across devices.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (Radix primitives), dark theme by default
- No database, no auth — every route works immediately
- All LLM calls go through Next.js Route Handlers to an OpenAI-compatible gateway

## Environment variables

Copy `.env.example` to `.env` and fill in your gateway details:

```
LLM_BASE_URL=http://192.168.1.20:20128/v1
LLM_API_KEY=your-key-here
LLM_MODELS=cx/gpt-5.5,cx/gpt-5.4,cx/gpt-5.3-codex,cx/gpt-5.2,cx/gpt-5.1,auto,cc/claude-sonnet-5
LLM_DEFAULT_MODEL=auto
NODE_ENV=production
```

- `LLM_BASE_URL` / `LLM_API_KEY` — your OpenAI-compatible gateway. Never exposed to the browser; only read server-side in Route Handlers.
- `LLM_MODELS` — comma-separated list shown in the model picker.
- `LLM_DEFAULT_MODEL` — model preselected in chat and used for PRD generation.

## Optional: Google Sign-In + Firestore sync

Both are fully optional. With none of the vars below set, the app runs exactly as described above — anonymous, `localStorage` only. Setting them adds a "Sign in" button in the top nav; signed-in users' chats/PRDs also sync to Firestore so they follow them across devices. Signed-out/anonymous usage is unaffected either way.

**1. Get the Firebase web config** (enables Feature A, sign-in):
1. Create/open a project at https://console.firebase.google.com
2. Build → Authentication → Sign-in method → enable **Google**.
3. Project settings (gear icon) → General → "Your apps" → add a Web app (or open the existing one) → copy the `firebaseConfig` values into the `NEXT_PUBLIC_FIREBASE_*` vars below.
4. Build → Firestore Database → create a database (any region), then paste the contents of `firestore.rules` (repo root) into Firestore → Rules and publish.

**2. Get the service account JSON** (enables Feature B, sync API routes):
1. Project settings → Service accounts → "Generate new private key" → downloads a JSON file.
2. Minify it to a single line (e.g. `jq -c . key.json`) and set it as `FIREBASE_SERVICE_ACCOUNT_JSON`. Keep this secret — never commit it or expose it to the client.

**3. Set the env vars** in `.env`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

If `FIREBASE_SERVICE_ACCOUNT_JSON` is missing or malformed, the `/api/sync/*` routes return `503` and log a warning — the rest of the app keeps working normally.

## Run locally

```bash
npm install
cp .env.example .env   # then edit with real values
npm run dev
```

`npm run build` works even with no network access — the build never calls the LLM gateway; all AI calls happen in dynamic Route Handlers at request time.

## Run with Docker

```bash
docker build -t prd-forge .
docker run -p 3000:3000 --env-file .env prd-forge
curl -s http://localhost:3000   # should return 200
```

The image uses Next's `output: "standalone"` build and runs `node server.js` — smaller image, no need for `npm start`/full `node_modules` at runtime. Build stage sets a placeholder `LLM_BASE_URL` only to satisfy code that reads the env var; it is never contacted during `docker build`.

## Notes

- Comparison mode requires selecting 2-3 models; the same prompt streams to each in parallel, one column per model.
- Last 5 generated PRDs are kept in a sidebar on `/plan`, click to reload into the preview. Copy/Download buttons work on the generated Markdown.
- Not every model in `LLM_MODELS` is guaranteed to be enabled on every gateway account — if a model returns an error, try another from the picker.
