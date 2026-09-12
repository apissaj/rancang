import { NextRequest, NextResponse } from "next/server";
import { DOC_NAMES, listBlueprints, resolveBlueprint, saveBlueprint } from "@/lib/mcp/store.mjs";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(60, 60_000);

const MAX_DOC_CHARS = 200_000;
const MAX_TOTAL_CHARS = 800_000;

/**
 * Blueprint bridge for the MCP layer.
 *
 * Rancang generates prd/spec/plan/tasks in the browser (localStorage). The MCP
 * server reads ~/.rancang/blueprints. This route is the hand-off: the web app
 * POSTs a finished blueprint here, the MCP server picks it up — so an agent in
 * Claude Code / Cursor / Codex can pull the exact blueprint you just made.
 *
 *   GET  /api/mcp/blueprint            → list saved blueprints
 *   GET  /api/mcp/blueprint?id=xxx     → one blueprint (all docs)
 *   POST /api/mcp/blueprint            → save/update one
 */

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const record = resolveBlueprint(id);
      if (!record) {
        return NextResponse.json({ error: `Blueprint not found: ${id}` }, { status: 404 });
      }
      return NextResponse.json({ blueprint: record });
    }
    const items = listBlueprints();
    return NextResponse.json({ count: items.length, blueprints: items });
  } catch (err) {
    console.error("[mcp/blueprint] list/read failed:", err);
    return NextResponse.json({ error: "Gagal memuat blueprint" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = limiter.check(req);
  if (blocked) return blocked;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, title, idea, model, docs } = (body ?? {}) as {
    id?: string;
    title?: string;
    idea?: string;
    model?: string;
    docs?: Record<string, string>;
  };

  const present = DOC_NAMES.filter((name) => typeof docs?.[name] === "string" && docs[name].trim());
  if (present.length === 0) {
    return NextResponse.json(
      { error: `Provide at least one of: ${DOC_NAMES.join(", ")}` },
      { status: 400 }
    );
  }

  // Cap doc sizes — docs are plain strings written straight to disk.
  let totalChars = 0;
  for (const name of present) {
    const len = docs![name].length;
    if (len > MAX_DOC_CHARS) {
      return NextResponse.json(
        { error: `Dokumen '${name}' melebihi batas ${MAX_DOC_CHARS} karakter` },
        { status: 413 }
      );
    }
    totalChars += len;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return NextResponse.json(
      { error: `Total blueprint melebihi batas ${MAX_TOTAL_CHARS} karakter` },
      { status: 413 }
    );
  }

  try {
    const record = saveBlueprint({ id, title, idea, model, docs, source: "web" });
    return NextResponse.json({
      ok: true,
      id: record.id,
      title: record.title,
      docs: present,
      saved_to: "~/.rancang/blueprints",
    });
  } catch (err) {
    console.error("[mcp/blueprint] save failed:", err);
    return NextResponse.json({ error: "Gagal menyimpan blueprint" }, { status: 500 });
  }
}
