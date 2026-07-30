const DEFAULT_MODELS = [
  "cx/gpt-5.5",
  "cx/gpt-5.4",
  "cx/gpt-5.3-codex",
  "cx/gpt-5.2",
  "cx/gpt-5.1",
  "auto",
  "cc/claude-sonnet-5",
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
  return process.env.LLM_DEFAULT_MODEL || process.env.NEXT_PUBLIC_LLM_DEFAULT_MODEL || "auto";
}
