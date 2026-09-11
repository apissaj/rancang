// Shared helpers for handing a blueprint's documents to the LLM.
// Used by /api/plan/chat (Q&A over the blueprint) and /api/plan/edit
// (rewrite one document while staying consistent with the others).

export type BlueprintDocs = Record<string, string>;

export const DOC_ORDER = ["prd", "spec", "plan", "tasks"] as const;

const DOC_LABELS: Record<string, string> = {
  prd: "PRD",
  spec: "SPEC",
  plan: "PLAN",
  tasks: "TASKS",
};

export function docLabel(name: string): string {
  return DOC_LABELS[name] ?? name.toUpperCase();
}

/**
 * Render the blueprint as labelled sections. `exclude` drops one document —
 * used when rewriting it, so the model isn't asked to revise text it is
 * simultaneously being handed as read-only context.
 */
export function buildBlueprintContext(docs: BlueprintDocs, opts?: { exclude?: string }): string {
  const parts: string[] = [];
  for (const name of DOC_ORDER) {
    if (opts?.exclude === name) continue;
    const content = docs[name];
    if (!content || !content.trim()) continue;
    parts.push(`=== ${docLabel(name)} (${name}.md) ===\n${content.trim()}`);
  }
  return parts.join("\n\n");
}
