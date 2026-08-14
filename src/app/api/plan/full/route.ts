import { streamChatCompletion, toTextDeltaStream } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

/**
 * Multi-document blueprint generator — combines Rancang UX with GitHub
 * Spec-Kit document structure. Generates 4 documents in parallel:
 *   prd.md, spec.md, plan.md, tasks.md
 * Each is streamed and framed with a marker header so the client can split
 * and render them separately.
 */

const DOC_SYSTEM_PROMPTS: Record<string, string> = {
  prd: `You are a senior product manager and staff engineer who writes precise, actionable PRDs.
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
- Output only the Markdown document, no preamble or commentary.`,

  spec: `You are a senior software architect writing a Feature Specification following the GitHub Spec-Kit format.
Given a short app or feature idea, produce a complete Feature Specification in GitHub-flavored Markdown.

Use exactly these top-level sections, in this order, each as an "## " heading:
1. User Scenarios & Testing (mandatory) — user stories PRIORITIZED as user journeys ordered by importance (P1, P2, P3...). Each story must be INDEPENDENTLY TESTABLE — if implemented alone it should still deliver a viable MVP. For each story include: description, why this priority, independent test, and acceptance scenarios in Given/When/Then format.
2. Edge Cases — boundary conditions and error scenarios
3. Technical Context — language/version, primary dependencies, storage, testing, target platform, project type, performance goals, constraints, scale/scope
4. Data Model — entities, fields, types, relations
5. API Surface — endpoints or functions with request/response shapes
6. Non-Functional Requirements — security, performance, availability, accessibility

Rules:
- Be specific to the idea given. Do not use placeholder text like "TBD" or "[FEATURE NAME]".
- Output only the Markdown document, no preamble or commentary.`,

  plan: `You are a staff engineer writing a technical Implementation Plan following the GitHub Spec-Kit format.
Given a short app or feature idea, produce a complete Implementation Plan in GitHub-flavored Markdown.

Use exactly these top-level sections, in this order, each as an "## " heading:
1. Summary — primary requirement + technical approach
2. Technical Context — language/version, primary dependencies, storage, testing, target platform, project type, performance goals, constraints, scale/scope (replace any "NEEDS CLARIFICATION" with a sensible default)
3. Project Structure — proposed directory layout for the source code (web app: backend/src/ + frontend/src/, single project: src/ + tests/)
4. Implementation Steps — ordered phases: Phase 0 research, Phase 1 design, Phase 2 implementation, Phase 3 testing. Each step should be a single concrete unit of work suitable for an AI coding agent to execute.
5. Risks & Mitigations

Rules:
- Be specific to the idea given. Do not use placeholder text like "TBD" or "[FEATURE]".
- Output only the Markdown document, no preamble or commentary.`,

  tasks: `You are a technical project manager generating an actionable task list following the GitHub Spec-Kit format.
Given a short app or feature idea, produce a complete Task List in GitHub-flavored Markdown.

Use exactly this format:
## Tasks: [Feature name]

**Input**: User description and clarifying answers

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: [ID] [P?] [Story] Description
- [P] marks tasks that can run in parallel (different files, no dependencies)
- [Story] marks which user story the task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

Sections:
1. Setup / Foundational Tasks — project scaffolding, config, CI
2. Story Tasks — one subsection per user story (US1, US2, ...), each task with ID, parallel marker, story reference, and concrete file paths
3. Polish / Hardening Tasks — error handling, edge cases, performance
4. Verification — how to test the whole thing end to end

Rules:
- Be specific to the idea given. Do not use placeholder text like "TBD".
- Output only the Markdown document, no preamble or commentary.`,
};

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
  const { idea, answers, model } = (await req.json()) as {
    idea: string;
    answers?: Answer[];
    model?: string;
  };

  if (!idea || !idea.trim()) {
    return new Response("idea is required", { status: 400 });
  }

  const chosenModel = model || getDefaultModel();
  const userMessage = buildUserMessage(idea, answers);
  const docs = ["prd", "spec", "plan", "tasks"] as const;

  try {
    // Fire all 4 LLM calls in parallel
    const streams = await Promise.all(
      docs.map(async (doc) => {
        const upstream = await streamChatCompletion(chosenModel, [
          { role: "system", content: DOC_SYSTEM_PROMPTS[doc] },
          { role: "user", content: userMessage },
        ]);
        return { doc, stream: toTextDeltaStream(upstream.body!) };
      })
    );

    // Frame each doc with a marker, then concatenate into one response stream.
    const encoder = new TextEncoder();
    const merged = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const { doc, stream } of streams) {
          controller.enqueue(
            encoder.encode(`\n\n<!-- DOC:${doc} -->\n\n`)
          );
          const reader = stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      },
    });

    return new Response(merged, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return new Response(message, { status: 502 });
  }
}
