# PRD Forge

Two AI tools in one app, no auth, no database, no accounts:

- **`/chat`** — multi-model chat with an optional side-by-side comparison mode.
- **`/plan`** — turn a rough idea into a structured PRD (Markdown), streamed live.

Chat history and generated PRDs persist only in your browser's `localStorage`. Nothing is stored server-side.

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
