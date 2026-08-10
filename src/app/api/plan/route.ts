import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a senior product manager and staff engineer who writes precise, actionable PRDs.
Given a short app or feature idea, produce a complete Product Requirements Document in GitHub-flavored Markdown.

Use exactly these top-level sections, in this order, each as an "## " heading:
1. Overview
2. Goals
3. User Stories
4. Functional Requirements
5. Non-Functional Requirements
6. Data Model (omit content and write "Not applicable" if the idea has no persisted data)
7. API/Feature Spec
8. Task Breakdown
9. Out of Scope

Rules:
- "Task Breakdown" must be a numbered list of small, actionable, sequential steps suitable for an AI coding agent to execute one at a time. Each step should be a single concrete unit of work.
- Be specific to the idea given. Do not use placeholder text like "TBD".
- Output only the Markdown document, no preamble or commentary.`;

type Answer = { question: string; selected: string[]; note?: string };

function buildUserMessage(idea: string, answers?: Answer[]): string {
  if (!answers || answers.length === 0) return idea;
  const lines = answers.map((a) => {
    const detail = a.note ? ` (${a.note})` : "";
    return `- ${a.question}: ${a.selected.join(", ")}${detail}`;
  });
  return `Clarifying answers:\n${lines.join("\n")}\n\nIdea:\n${idea}`;
}

export async function POST(req: Request) {
  const { idea, answers } = (await req.json()) as { idea: string; answers?: Answer[] };

  if (!idea || !idea.trim()) {
    return new Response("idea is required", { status: 400 });
  }

  try {
    const upstream = await streamChatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(idea, answers) },
    ]);
    return new Response(toTextDeltaStream(upstream.body!), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(message, { status: 502 });
  }
}
