import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { getExecutionLogs } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(120, 60_000);

/**
 * GET /api/mcp/history?blueprint_id=...
 * Read-only access to a blueprint's execution logs (last 100).
 */
export async function GET(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;

  const blueprintId = req.nextUrl.searchParams.get("blueprint_id");

  if (!blueprintId || !blueprintId.trim()) {
    return NextResponse.json(
      { error: "Parameter blueprint_id wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const logs = getExecutionLogs(blueprintId.trim());
    return NextResponse.json({ blueprintId: blueprintId.trim(), count: logs.length, logs });
  } catch (err) {
    console.error("[api/mcp/history] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memuat execution logs" },
      { status: 500 }
    );
  }
}