/**
 * Per-IP rate limiter (in-memory). Sliding-window counter.
 *
 * Usage:  const rl = rateLimiter(30, 60_000);
 *         const blocked = rl.check(req);
 *         if (blocked) return blocked; // NextResponse 429
 *
 * NOTE: each limiter instance gets its own bucket map. Requests arrive at a
 * single Next.js process, so a shared Map across routes would let one route's
 * traffic starve another. Also: `x-forwarded-for` is client-writable, so it is
 * ignored unless the request came through a trusted proxy — see `clientIp`.
 */

import { NextResponse } from "next/server";

type Entry = { count: number; resetAt: number };

/** Best-effort, IPv4/IPv6 aware. `req.ip` is only trusted when the app runs behind Next's proxy handling. */
function clientIp(req: Request): string {
  const hasTrustedProxy = process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production";
  if (hasTrustedProxy) {
    const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (fwd) return fwd;
  }
  return (req as NextRequestWithIp).ip ?? req.headers.get("x-real-ip") ?? "127.0.0.1";
}

interface NextRequestWithIp extends Request {
  ip?: string;
}

export function rateLimiter(maxRequests = 30, windowMs = 60_000) {
  const store = new Map<string, Entry>();
  function cleanup(now: number) {
    for (const [k, v] of store) {
      if (v.resetAt <= now) store.delete(k);
    }
  }
  return {
    /** Returns NextResponse 429 if blocked, otherwise null. */
    check(req: Request): NextResponse | null {
      const ip = clientIp(req);

      const now = Date.now();
      // Opportunistic cleanup so the map never grows unbounded.
      if (store.size > 1000) cleanup(now);

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
