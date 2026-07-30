import type { ChatMessage } from "@/lib/llm";

/**
 * POSTs to /api/chat and streams plain-text deltas, calling onDelta as chunks
 * arrive. Resolves with the full accumulated text.
 */
export async function streamChat(
  model: string,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onDelta(chunk);
  }
  return full;
}
