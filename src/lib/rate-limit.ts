/**
 * Per-IP rate limiter (in-memory). Sliding-window counter.
 *
 * Usage:  const rl = rateLimiter(30, 60_000);
 *         const blocked = rl.check(req);
 *         if (blocked) return blocked; // NextResponse 429
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

function cleanup(now: number) {
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
}

/**
 * @param maxRequests - max requests in the window
 * @param windowMs   - window duration in milliseconds
 */
export function rateLimiter(maxRequests = 30, windowMs = 60_000) {
  return {
    /** Returns NextResponse 429 if blocked, otherwise null. */
    check(req: Request): NextResponse | null {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "127.0.0.1";

      const now = Date.now();
      const entry = store.get(ip);

      if (!entry || now >= entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + windowMs });
        return null;
      }

      entry.count++;
      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Try again in ${retryAfter}s.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }
      return null;
    },
  };
}
