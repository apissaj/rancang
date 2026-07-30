// Self-check for the SSE-to-text-delta parsing logic used in llm.ts (toTextDeltaStream).
// llm.ts itself is guarded with `server-only`, so we exercise the same parsing algorithm
// directly here rather than importing it. Run: node src/lib/llm.test.mjs
import assert from "node:assert";

function toTextDeltaStream(upstream) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
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
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {}
        }
      }
      controller.close();
    },
  });
}

async function readAll(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

function sseStream(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

const sse = sseStream([
  `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}\n\n`,
  `data: ${JSON.stringify({ choices: [{ delta: { content: "lo" } }] })}\n\n`,
  `data: [DONE]\n\n`,
]);

const text = await readAll(toTextDeltaStream(sse));
assert.strictEqual(text, "Hello");
console.log("toTextDeltaStream SSE parsing: OK");
