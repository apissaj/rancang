import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel, getAvailableModels } from "@/lib/models";
import { buildBlueprintContext, docLabel, type BlueprintDocs } from "@/lib/blueprint-context";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = rateLimiter(20, 60_000);

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
  const blocked = limiter.check(req);
  if (blocked) return blocked;

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
  if (body.markdown && body.markdown.length > 50000) {
    return new Response(`markdown terlalu panjang (maks 50.000 karakter)`, { status: 400 });
  }
  if (body.instruction && body.instruction.length > 5000) {
    return new Response(`instruction terlalu panjang (maks 5.000 karakter)`, { status: 400 });
  }

  // docs: cap each doc value
  if (body.docs) {
    const keys = Object.keys(body.docs);
    for (const k of keys) {
      if (typeof body.docs[k] === "string" && body.docs[k].length > 50000) {
        return new Response(`docs.${k} terlalu panjang (maks 50.000 karakter)`, { status: 400 });
      }
    }
  }

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

  const models = getAvailableModels();
  const chosenModel = body.model || getDefaultModel();
  if (!models.includes(chosenModel)) {
    return new Response(`Model "${chosenModel}" is not available. Available models: ${models.join(", ")}`, { status: 400 });
  }

  const userMessage =
    (context
      ? `The other documents (read-only context — do NOT rewrite them):\n---\n${context}\n---\n\n`
      : "") +
    (target
      ? `Current ${docLabel(target)} (${target}.md):\n---\n${currentMarkdown}\n---\n\nInstruction:\n${instruction}`
      : `Current PRD:\n---\n${currentMarkdown}\n---\n\nInstruction:\n${instruction}`);

  try {
    const upstream = await streamChatCompletion(chosenModel, [
      { role: "system", content: systemForTarget(target) },
      { role: "user", content: userMessage },
    ]);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[plan/edit] stream failed:", err);
    return new Response("Gagal menghubungi model AI", { status: 502 });
  }
}
