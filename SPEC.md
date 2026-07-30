Build a Next.js 15 (App Router) web app called "PRD Forge" — an MVP combining two features inspired by ngodingpakeai.com/plan and andalai.id, WITHOUT auth, WITHOUT a database, WITHOUT community/coaching features. Chat/plan history persists in browser localStorage only.

## Stack (mandatory)
- Next.js 15 App Router, TypeScript
- Tailwind CSS v4
- shadcn/ui components (Radix primitives) — dark theme by default, clean minimal SaaS look
- No database. No auth. No external services besides the one LLM gateway below.
- Single Dockerfile, multi-stage build, production `next start` on port 3000
- Must build and run via plain `docker build` + `docker run` with only env vars — no host networking assumptions, no localhost hardcoding

## LLM backend (mandatory — reuse existing gateway, do NOT add new API keys)
All AI calls go through an OpenAI-compatible endpoint:
- Base URL: value of env var `LLM_BASE_URL` (e.g. `http://192.168.1.20:20128/v1`)
- API key: value of env var `LLM_API_KEY`
- Available models (hardcode this list, env var `LLM_MODELS` as comma-separated override):
  `cx/gpt-5.5,cx/gpt-5.4,cx/gpt-5.3-codex,cx/gpt-5.2,cx/gpt-5.1,auto,cc/claude-sonnet-5`
- Use the standard `POST /chat/completions` with `stream: true` (SSE) for chat responses.
- All LLM calls happen server-side (Next.js Route Handlers / Server Actions) — never expose `LLM_API_KEY` to the browser.

## Feature 1 — Multi-model chat (inspired by andalai.id)
- Route: `/chat`
- Chat UI: message list (user/assistant bubbles), composer at bottom with textarea, Enter to send / Shift+Enter for newline
- Model picker dropdown in the composer — pick one of the models from `LLM_MODELS`, default "auto"
- "Comparison mode" toggle: when ON, let the user select 2-3 models and send the same prompt to all of them in parallel; render each model's streaming response side-by-side in columns (responsive: stack vertically on mobile)
- Streaming responses token-by-token (SSE) — show a loading/typing indicator until first token arrives
- Chat history (list of past conversations) in a left sidebar, persisted to localStorage, new-chat button, delete-chat button
- Markdown rendering for assistant responses (code blocks with syntax highlighting, lists, bold/italic)
- Copy-to-clipboard button on each assistant message

## Feature 2 — PRD Generator (inspired by ngodingpakeai.com/plan)
- Route: `/plan`
- Simple form: user describes their app/feature idea in a textarea (with a few example prompts as placeholder suggestions)
- On submit, call the LLM (server-side) with a system prompt engineered to produce a structured PRD in Markdown with these sections: Overview, Goals, User Stories, Functional Requirements, Non-Functional Requirements, Data Model (if applicable), API/Feature Spec, Task Breakdown (numbered, actionable steps suitable for an AI coding agent to execute one at a time), Out of Scope
- Stream the PRD generation live into a Markdown preview pane (split view: form on left/top, live-rendering PRD preview on right/bottom)
- Once generated: "Copy Markdown" button and "Download as .md" button
- Keep last 5 generated PRDs in a sidebar list (localStorage), clickable to reload into the preview

## Shared UI
- Top nav: logo/title "PRD Forge", links to `/chat` and `/plan`, dark/light mode toggle (default dark)
- Landing page `/`: brief hero explaining the two tools, two big cards linking to `/chat` and `/plan` (visually similar structure to ngodingpakeai.com's "Bikin Plan" / "AndalAI" cards, but original copy, do not copy their exact text/branding/logo)
- Responsive, works on mobile
- No sign-in/sign-up screens anywhere — every route must be usable immediately with zero auth

## Environment variables (.env.example must document all of these)
```
LLM_BASE_URL=http://192.168.1.20:20128/v1
LLM_API_KEY=your-key-here
LLM_MODELS=cx/gpt-5.5,cx/gpt-5.4,cx/gpt-5.3-codex,cx/gpt-5.2,cx/gpt-5.1,auto,cc/claude-sonnet-5
LLM_DEFAULT_MODEL=auto
NODE_ENV=production
```

## Dockerfile requirements
- `FROM node:20-alpine` (or slim) multi-stage: deps -> build -> runner
- Must NOT fail if it can't reach `LLM_BASE_URL` at build time (no server-side data fetching that calls the LLM at build/static-generation time — this app has no static pages that need live data, keep everything client-fetched or dynamic route handlers)
- `EXPOSE 3000`, `CMD ["node", "server.js"]` if using standalone output, or `npm start` otherwise — pick whichever is more reliable, document your choice
- Include a `.dockerignore` (node_modules, .next, .git, .env)

## Deliverables checklist (must all be true when you're done)
1. `npm install && npm run build` succeeds locally with no LLM reachable (build must not depend on network)
2. `docker build -t prd-forge .` succeeds
3. Running the container with correct env vars and `docker run -p 3000:3000 --env-file .env prd-forge`, then `curl -s http://localhost:3000` returns HTTP 200
4. `/chat` renders, accepts a message, and streams a real response from the configured LLM_BASE_URL (test with a real prompt like "say hi in 5 words")
5. Comparison mode: selecting 2 models and sending one prompt shows 2 side-by-side streaming responses
6. `/plan` renders, submitting an idea produces a real streamed PRD in Markdown with all required sections
7. Copy and Download buttons work on the plan page
8. No TypeScript errors, no ESLint errors block the build
9. README.md documents setup, env vars, and how to run via Docker

Write clean, readable code. Prefer official Next.js/shadcn patterns over custom abstractions. Commit incrementally with clear messages. When finished, run the full deliverables checklist yourself and report any that fail.
