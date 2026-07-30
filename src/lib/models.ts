const DEFAULT_MODELS = [
  "cx/gpt-5.6-sol",
  "cx/gpt-5.6-terra",
  "cx/gpt-5.6-luna",
  "cx/gpt-5.5",
  "cx/gpt-5.4",
  "ag/gemini-3.6-flash-high",
  "ag/claude-sonnet-4-6",
  "ag/claude-opus-4-6-thinking",
  "cc/claude-opus-5",
  "cc/claude-sonnet-5",
  "cc/claude-haiku-4-5-20251001",
];

export function getAvailableModels(): string[] {
  const fromEnv = process.env.LLM_MODELS || process.env.NEXT_PUBLIC_LLM_MODELS;
  if (!fromEnv) return DEFAULT_MODELS;
  return fromEnv
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

export function getDefaultModel(): string {
  return process.env.LLM_DEFAULT_MODEL || process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL || "cc/claude-sonnet-5";
}
