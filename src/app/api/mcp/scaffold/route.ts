import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { scaffoldProject, resolveAllowedDir, AgentFormat } from "@/lib/scaffold";
import { getRecommendedFormat } from "@/lib/detect-agent";
import { saveBlueprintVersion } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(15, 60_000);

/**
 * POST /api/mcp/scaffold
 * Body: { blueprintId?: string, targetDir: string, format?: string }
 * Auto-detects the best agent format if format is omitted.
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

  const { blueprintId, targetDir } = (body ?? {}) as {
    blueprintId?: string;
    targetDir?: string;
  };

  if (!targetDir || !targetDir.trim()) {
    return NextResponse.json({ error: "Parameter targetDir wajib diisi" }, { status: 400 });
  }

  // Auto-detect if no format provided
  let format = (body as Record<string, unknown>)?.format as string | undefined;
  if (!format) {
    format = getRecommendedFormat(process.cwd());
  }

  const validFormats: (AgentFormat | undefined)[] = ["agents","claude","codex","cursor","cline","windsurf","copilot","opencode","all",undefined];
  if (!validFormats.includes(format as AgentFormat | undefined)) {
    return NextResponse.json({ error: `Invalid format "${format}". Valid: agents,claude,codex,cursor,cline,windsurf,copilot,opencode,all` }, { status: 400 });
  }

  let safeDir: string;
  try {
    safeDir = resolveAllowedDir(targetDir.trim());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Direktori tidak diizinkan" },
      { status: 400 }
    );
  }

  try {
    // Snapshot a version before scaffolding, so the pre-scaffold state is
    // recoverable if the generated files need re-rolling.
    if (blueprintId) {
      try {
        saveBlueprintVersion(blueprintId, "before scaffold");
      } catch (versionErr) {
        console.warn("[mcp/scaffold] saveBlueprintVersion skipped:", versionErr);
      }
    }

    const result = await scaffoldProject({
      blueprintId: blueprintId || undefined,
      targetDir: safeDir,
      format: format as AgentFormat,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mcp/scaffold] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}