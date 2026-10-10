import { NextRequest, NextResponse } from "next/server";
import { syncTasksFromMarkdown, summarizeTasks, resolveBlueprint } from "@/lib/mcp/store.mjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const blueprintId = body.blueprintId || body.blueprint_id;
    const markdown = body.markdown;

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

    const result = syncTasksFromMarkdown(blueprintId, markdown);
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
