import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { syncTasksFromMarkdown, summarizeTasks, resolveBlueprint } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

const limiter = rateLimiter(30, 60_000);

export async function POST(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;
  try {
    const body = await req.json();
    const blueprintId = body.blueprintId || body.blueprint_id;
    const markdown = body.markdown;
    const agent = typeof body.agent === "string" ? body.agent : undefined;

    if (!blueprintId || typeof blueprintId !== "string") {
      return NextResponse.json(
        { error: "blueprintId wajib diisi" },
        { status: 400 }
      );
    }

    if (!markdown || typeof markdown !== "string") {
      return NextResponse.json(
        { error: "markdown string wajib diisi (isi TASKS.md)" },
        { status: 400 }
      );
    }

    const result = syncTasksFromMarkdown(blueprintId, markdown, agent);
    const tasks = result.tasks || [];
    const summary = result.summary || summarizeTasks(tasks);
    const bp = resolveBlueprint(blueprintId);

    return NextResponse.json({
      ok: true,
      blueprintId: bp.id,
      summary,
      taskCount: tasks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
