import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { ClarifyResponse } from "@/lib/clarify-types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a senior product manager doing scoping before writing a PRD.
Given a short app or feature idea, decide what's ambiguous or under-specified enough that
answering it up front would meaningfully change the resulting PRD (the "Rung 1: does this
need clarifying at all" check). Ask 3-6 multiple-choice clarifying questions, each with 2-5
options.

Respond with ONLY valid JSON, no markdown code fences, no commentary, matching exactly this shape:
{
  "intro": "1-2 sentence framing of what you're asking and why (can be empty string)",
  "questions": [
    {
      "id": "short_slug",
      "question": "the question text",
      "type": "single" | "multi",
      "options": [
        { "id": "option_slug", "label": "option label", "allowsNote": true }
      ]
    }
  ]
}

"type": "single" means the user picks exactly one option (radio buttons). "type": "multi" means
the user can pick any number (checkboxes). Set "allowsNote": true on an option only when it
represents an open-ended choice (e.g. "Other") that benefits from a free-text detail field.
Output only the JSON object.`;

/** Strip markdown code fences models sometimes wrap JSON in despite instructions. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidClarifyResponse(v: unknown): v is ClarifyResponse {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.intro !== "string") return false;
  if (!Array.isArray(r.questions)) return false;
  return r.questions.every((q: unknown) => {
    if (!q || typeof q !== "object") return false;
    const qq = q as Record<string, unknown>;
    return (
      typeof qq.id === "string" &&
      typeof qq.question === "string" &&
      (qq.type === "single" || qq.type === "multi") &&
      Array.isArray(qq.options) &&
      qq.options.every(
        (o: unknown) =>
          !!o && typeof o === "object" && typeof (o as Record<string, unknown>).id === "string" && typeof (o as Record<string, unknown>).label === "string"
      )
    );
  });
}

export async function POST(req: Request) {
  const { idea } = (await req.json()) as { idea: string };

  if (!idea || !idea.trim()) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }

  try {
    const raw = await chatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: idea },
    ]);
    const parsed = parseJsonLoose(raw);
    if (!isValidClarifyResponse(parsed)) {
      throw new Error("Model returned malformed clarify JSON");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
