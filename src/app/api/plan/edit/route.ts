import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are revising an existing PRD based on the user's instruction. Return the FULL revised PRD in the same Markdown structure/sections, not a diff or partial excerpt, no preamble/commentary.`;

function buildUserMessage(markdown: string, instruction: string): string {
  return `Current PRD:\n---\n${markdown}\n---\n\nInstruction:\n${instruction}`;
}

export async function POST(req: Request) {
  const { markdown, instruction } = (await req.json()) as { markdown: string; instruction: string };

  if (!markdown || !markdown.trim()) {
    return new Response("markdown is required", { status: 400 });
  }
  if (!instruction || !instruction.trim()) {
    return new Response("instruction is required", { status: 400 });
  }

  try {
    const upstream = await streamChatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(markdown, instruction) },
    ]);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return new Response(message, { status: 502 });
  }
}
