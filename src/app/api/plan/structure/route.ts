import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { StructureResponse } from "@/lib/clarify-types";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a senior product manager scoping an app before writing a PRD.
Given a short app or feature idea (and optionally the user's clarifying answers), break it
down into a 3-level feature structure: a planning theme, the main features, and the
sub-features under each feature.

Respond with ONLY valid JSON, no markdown code fences, no commentary, matching exactly this shape:
{
  "planning": "one short phrase naming the overall planning theme / product goal",
  "fitur": [
    {
      "name": "feature name",
      "subFitur": ["sub-feature 1", "sub-feature 2", "sub-feature 3"]
    }
  ]
}

Rules:
- "planning" is a single short phrase (e.g. "Aplikasi To-Do Kolaboratif").
- Produce 3-6 features.
- Each feature has 2-5 concrete sub-features (specific, actionable, not vague).
- Use Indonesian. Keep names concise (2-6 words).
- Output only the JSON object.`;

/** Strip markdown code fences models sometimes wrap JSON in despite instructions. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function POST(req: Request) {
  try {
    const { idea, answers, model } = (await req.json()) as {
      idea: string;
      answers?: Array<{ question: string; selected?: string[]; note?: string }>;
      model?: string;
    };
    if (!idea || !idea.trim()) {
      return new Response("idea is required", { status: 400 });
    }

    const answerText = answers?.length
      ? `\n\nUser's clarifying answers:\n` +
        answers.map((a) => `- ${a.question}: ${(a.selected ?? []).join(", ")}${a.note ? ` (${a.note})` : ""}`).join("\n")
      : "";

    const completion = await chatCompletion(
      model || getDefaultModel(),
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Ide: ${idea}${answerText}` },
      ],
    );

    const parsed = parseJsonLoose(completion) as StructureResponse;
    if (!parsed.planning || !Array.isArray(parsed.fitur)) {
      throw new Error("invalid structure response");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to build structure";
    return new Response(message, { status: 502 });
  }
}
