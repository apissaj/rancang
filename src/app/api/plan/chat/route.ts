import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import { buildBlueprintContext, type BlueprintDocs } from "@/lib/blueprint-context";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const limiter = rateLimiter(20, 60_000);

// Cost guard: refuse absurdly large payloads instead of forwarding them upstream.
const MAX_CONTEXT_CHARS = 400_000;
// Only the tail of a long conversation is relevant; the blueprint is the durable
// context. Keeps the prompt bounded as the chat grows.
const MAX_HISTORY_MESSAGES = 20;

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM_PROMPT = `You are the AI collaborator for a product blueprint made of up to four documents:
PRD (prd.md), SPEC (spec.md), PLAN (plan.md), TASKS (tasks.md).

Answer the user's question about the blueprint. Rules:
- Be concrete: quote task ids (e.g. T7), section names, and document names.
- Reply in the language the user wrote in (Indonesian → Indonesian).
- Be concise. No filler preamble, no restating the question.
- Never invent features, endpoints, tables, or file paths that the blueprint does not contain.
  If the blueprint does not answer the question, say so and name the gap.

This is a QUESTION-AND-ANSWER exchange: do NOT rewrite a document here. If the user's
message is a request to change something, explain what you would change and tell them to
press "Terapkan" (Apply) so the document gets rewritten in a dedicated pass.`;

export async function POST(req: Request) {
  const blocked = limiter.check(req);
  if (blocked) return blocked;

  const { docs, history, message, model } = (await req.json()) as {
    docs?: BlueprintDocs;
    history?: Msg[];
    message?: string;
    model?: string;
  };

  if (!docs || Object.values(docs).every((v) => !v?.trim())) {
    return new Response("docs is required (at least one document must have content)", { status: 400 });
  }
  if (!message?.trim()) {
    return new Response("message is required", { status: 400 });
  }

  const blueprint = buildBlueprintContext(docs);
  const trimmed = (history ?? []).slice(-MAX_HISTORY_MESSAGES);

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "system" as const, content: `=== BLUEPRINT ===\n${blueprint}` },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  const size = messages.reduce((n, m) => n + m.content.length, 0);
  if (size > MAX_CONTEXT_CHARS) {
    return new Response(
      `Konteks terlalu panjang (${Math.round(size / 1000)}rb karakter). Hapus beberapa dokumen atau mulai chat baru.`,
      { status: 413 }
    );
  }

  try {
    const upstream = await streamChatCompletion(model || getDefaultModel(), messages);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return new Response(msg, { status: 502 });
  }
}
