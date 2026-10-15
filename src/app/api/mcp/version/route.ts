import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { saveBlueprintVersion } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(60, 60_000);

/**
 * POST /api/mcp/version
 * Body: { blueprint_id: string, note?: string }
 * Snapshot the blueprint's docs as a new version before a significant change.
 */
export async function POST(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { blueprint_id, note } = (body ?? {}) as {
    blueprint_id?: string;
    note?: string;
  };

  if (!blueprint_id || !blueprint_id.trim()) {
    return NextResponse.json(
      { error: "blueprint_id wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const result = saveBlueprintVersion(blueprint_id.trim(), note || "");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/mcp/version] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal menyimpan versi blueprint" },
      { status: 500 }
    );
  }
}