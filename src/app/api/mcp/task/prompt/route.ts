import { NextRequest, NextResponse } from "next/server";
import { resolveBlueprint, parseTasks, buildTaskPrompt } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(30, 60_000);

/**
 * GET /api/mcp/task/prompt?blueprintId=...&taskId=...
 * Returns a focused, self-contained execution prompt for a single task
 * (ngodingpakeai-style `task get <id>`).
 */
export async function GET(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const blueprintId = url.searchParams.get("blueprintId") || undefined;
  const taskId = url.searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "Parameter taskId wajib diisi" }, { status: 400 });
  }

  try {
    const record = resolveBlueprint(blueprintId);
    if (!record) {
      return NextResponse.json({ error: `Blueprint tidak ditemukan: ${blueprintId || "latest"}` }, { status: 404 });
    }

    const tasks = parseTasks(record.docs?.tasks || "");
    const wanted = taskId.trim().toUpperCase();
    const task = tasks.find((t: { id?: string }) => (t.id || "").toUpperCase() === wanted);

    if (!task) {
      return NextResponse.json({ error: `Task ${taskId} tidak ditemukan di blueprint ini` }, { status: 404 });
    }

    const prompt = buildTaskPrompt(record, task);
    return NextResponse.json({
      ok: true,
      blueprintId: record.id,
      taskId: task.id,
      task,
      prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[mcp/task/prompt] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}