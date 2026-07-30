import "server-only";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Calls the OpenAI-compatible chat completions endpoint and returns the raw
 * upstream Response (SSE stream). Caller is responsible for forwarding/parsing.
 */
export async function streamChatCompletion(model: string, messages: ChatMessage[]) {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (!baseUrl) throw new Error("LLM_BASE_URL is not configured");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM gateway error (${res.status}): ${text || res.statusText}`);
  }

  return res;
}

/**
 * Transforms an upstream OpenAI-style SSE stream (data: {...}\n\n) into a
 * plain text stream of token deltas, so the client doesn't need an SSE parser.
 */
export function toTextDeltaStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta: string | undefined = json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ignore malformed SSE chunks
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        controller.close();
      }
    },
  });
}
