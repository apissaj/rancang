import { NextRequest, NextResponse } from "next/server";
import { searchTasks } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(120, 60_000);

/**
 * GET /api/mcp/search?query=...&blueprint_id=...
 * Search tasks across all blueprints (or a specific one).
 */
export async function GET(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  const query = req.nextUrl.searchParams.get("query") || "";
  const blueprintId = req.nextUrl.searchParams.get("blueprint_id");

  try {
    const results = searchTasks(query, blueprintId || undefined);
    return NextResponse.json({ query, blueprintId: blueprintId || null, count: results.length, results });
  } catch (err) {
    console.error("[api/mcp/search] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mencari tasks" },
      { status: 500 }
    );
  }
}