import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { resolveBlueprint, parseTasks, completeTask, summarizeTasks, nextTask } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(120, 60_000);

export async function GET(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;

  const blueprintId = req.nextUrl.searchParams.get("blueprintId") || "latest";

  try {
    const record = resolveBlueprint(blueprintId);
    if (!record) {
      return NextResponse.json({ error: `Blueprint tidak ditemukan: ${blueprintId}` }, { status: 404 });
    }

    const tasksMarkdown = record.docs?.tasks || "";
    const tasks = parseTasks(tasksMarkdown);
    const summary = summarizeTasks(tasksMarkdown);
    const next = tasks.find((t: { done: boolean }) => !t.done) || null;

    return NextResponse.json({
      blueprintId: record.id,
      title: record.title || "Untitled",
      summary,
      next,
      tasks,
    });
  } catch (err) {
    console.error("[api/mcp/task] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal membaca tasks" },
      { status: 500 }
    );
  }
}

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

  const { blueprintId, taskId, done } = (body ?? {}) as {
    blueprintId?: string;
    taskId?: string;
    done?: boolean;
  };

  if (!blueprintId || !taskId) {
    return NextResponse.json(
      { error: "blueprintId dan taskId wajib diisi" },
      { status: 400 }
    );
  }

  try {
    const result = completeTask(blueprintId, taskId, done !== false);
    const record = resolveBlueprint(blueprintId);
    const summary = record?.docs?.tasks ? summarizeTasks(record.docs.tasks) : null;
    const next = nextTask(blueprintId);

    return NextResponse.json({
      ok: true,
      blueprintId: result.id,
      taskId: result.taskId,
      done: result.done,
      summary,
      next: next.next,
      tasks: result.tasks,
    });
  } catch (err) {
    console.error("[api/mcp/task] POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengubah status task" },
      { status: 500 }
    );
  }
}
