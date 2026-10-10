import { NextRequest, NextResponse } from "next/server";
import { indexCodebase, buildCodebaseContext } from "@/lib/sync";
import { resolveAllowedDir } from "@/lib/scaffold";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(10, 60_000);

/**
 * GET /api/mcp/sync?dir=<path>
 * Indexes the codebase and returns context summary for coding agents.
 */
export async function GET(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  const dir = req.nextUrl.searchParams.get("dir") || process.cwd();

  try {
    const safeDir = resolveAllowedDir(dir);
    const index = indexCodebase(safeDir, { maxDepth: 4, maxFiles: 500 });
    const context = buildCodebaseContext(safeDir, { maxDepth: 4, maxFiles: 500 });
    return NextResponse.json({ ok: true, ...index, context }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}