import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import { buildBlueprintContext, docLabel, type BlueprintDocs } from "@/lib/blueprint-context";

export const dynamic = "force-dynamic";

function systemForTarget(target?: string): string {
  if (target) {
    const label = docLabel(target);
    return (
      `You are revising exactly one document of a larger blueprint: ${label} (${target}.md).\n` +
      `The other documents are read-only context — do NOT include them in the response.\n` +
      `Return the FULL revised ${label} and nothing else (no wrapper, no headings added beyond what the ${label} calls for).`
    );
  }
  return "You are revising a single-document blueprint (PRD). Return the FULL revised document in the same structure, not a diff or partial excerpt, no preamble or commentary.";
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    markdown?: string;
    instruction?: string;
    docs?: BlueprintDocs;
    target?: string;
    model?: string;
  };

  const instruction: string = body.instruction ?? "";
  if (!instruction.trim()) {
    return new Response("instruction is required", { status: 400 });
  }

  const rawTarget: string | undefined = body.target?.trim() || undefined;
  const ALLOWED_TARGETS = ["prd", "spec", "plan", "tasks"] as const;
  type AllowedTarget = typeof ALLOWED_TARGETS[number];
  if (rawTarget && !ALLOWED_TARGETS.includes(rawTarget as AllowedTarget)) {
    return new Response(`Target tidak valid: "${rawTarget}". Pilih salah satu: ${ALLOWED_TARGETS.join(", ")}.`, {
      status: 400,
    });
  }
  const target: AllowedTarget | undefined = rawTarget as AllowedTarget | undefined;
  let currentMarkdown: string;
  let context: string;

  if (body.docs && Object.values(body.docs).some((v) => v?.trim())) {
    currentMarkdown = (body.docs[target ?? "prd"] ?? "").trim();
    if (!currentMarkdown) {
      return new Response(`Dokumen kosong: target "${target ?? "prd"}" tidak ada. Tidak ada yang perlu direvisi.`, {
        status: 400,
      });
    }
    context = buildBlueprintContext(body.docs, { exclude: target });
  } else if (body.markdown?.trim()) {
    // Legacy shape: single PRD without docs.
    currentMarkdown = body.markdown;
    context = "";
  } else {
    return new Response("markdown or docs with a matching target is required", { status: 400 });
  }

  const userMessage =
    (context
      ? `The other documents (read-only context — do NOT rewrite them):\n---\n${context}\n---\n\n`
      : "") +
    (target
      ? `Current ${docLabel(target)} (${target}.md):\n---\n${currentMarkdown}\n---\n\nInstruction:\n${instruction}`
      : `Current PRD:\n---\n${currentMarkdown}\n---\n\nInstruction:\n${instruction}`);

  try {
    const upstream = await streamChatCompletion(body.model || getDefaultModel(), [
      { role: "system", content: systemForTarget(target) },
      { role: "user", content: userMessage },
    ]);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return new Response(message, { status: 502 });
  }
}
