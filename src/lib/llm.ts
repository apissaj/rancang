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
 * Calls the chat completions endpoint non-streaming and returns the full
 * assistant text. For one-shot structured (e.g. JSON) responses.
 */
export async function chatCompletion(model: string, messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  if (!baseUrl) throw new Error("LLM_BASE_URL is not configured");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM gateway error (${res.status}): ${text || res.statusText}`);
  }

  const json = await res.json();
  const content: string | undefined = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM gateway returned no content");
  return content;
}

/**
 * Transforms an upstream OpenAI-style SSE stream (data: {...}\n\n) into a
 * plain text stream of token deltas, so the client doesn't need an SSE parser.
 */
export function toTextDeltaStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let sseBuffer = "";
  // Some reasoning models (e.g. Test-Combo) prefix output with a <think>...</think>
  // block. Strip it before it ever reaches the client — buffer deltas until we
  // know we are past </think>, or until it's clear there is no think block at all.
  let textBuffer = "";
  let pastThink = false;

  function emit(controller: ReadableStreamDefaultController<Uint8Array>, delta: string) {
    if (pastThink) {
      controller.enqueue(encoder.encode(delta));
      return;
    }
    textBuffer += delta;
    const closeIdx = textBuffer.indexOf("</think>");
    if (closeIdx !== -1) {
      const rest = textBuffer.slice(closeIdx + "</think>".length);
      pastThink = true;
      textBuffer = "";
      if (rest) controller.enqueue(encoder.encode(rest));
      return;
    }
    // No </think> seen yet. If buffer clearly isn't starting a <think> block
    // (first non-whitespace chars don't match "<think" prefix so far), flush
    // it as normal text — most responses have no think block at all.
    const probe = textBuffer.trimStart();
    if (probe.length > 0 && !"<think>".startsWith(probe.slice(0, Math.min(probe.length, 7)))) {
      pastThink = true;
      controller.enqueue(encoder.encode(textBuffer));
      textBuffer = "";
    }
  }

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta: string | undefined = json.choices?.[0]?.delta?.content;
              if (delta) emit(controller, delta);
            } catch {
              // ignore malformed SSE chunks
            }
          }
        }
        // Flush anything still buffered (e.g. response ended before we could confirm no think block)
        if (!pastThink && textBuffer) controller.enqueue(encoder.encode(textBuffer));
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        controller.close();
      }
    },
  });
}
