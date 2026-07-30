# syntax=docker/dockerfile:1

# --- deps: install dependencies only, cached separately from source changes ---
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- builder: compile the Next.js app (no network calls to LLM_BASE_URL happen here) ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy build-time env: never contacted, just satisfies any code path that reads it.
ENV LLM_BASE_URL=http://build-time-placeholder.invalid/v1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner: minimal production image using Next's standalone output ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
