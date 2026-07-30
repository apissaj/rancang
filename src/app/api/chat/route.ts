import { streamChatCompletion, toTextDeltaStream, type ChatMessage } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { model, messages } = (await req.json()) as { model: string; messages: ChatMessage[] };

  if (!model || !Array.isArray(messages)) {
    return new Response("model and messages are required", { status: 400 });
  }

  try {
    const upstream = await streamChatCompletion(model, messages);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 502 });
  }
}
