import "server-only";

export async function generateScreenImage(prompt: string): Promise<string> {
  const baseUrl = process.env.IMAGE_GEN_BASE_URL;
  const apiKey = process.env.IMAGE_GEN_API_KEY;
  const model = process.env.IMAGE_GEN_MODEL;
  if (!baseUrl || !model) throw new Error("Image generation is not configured");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ model, prompt, n: 1, size: "1024x1024" }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Image gateway error (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image gateway returned no image data");
  return `data:image/png;base64,${b64}`; // returned directly as a data URL, ready for an <img src>
}
