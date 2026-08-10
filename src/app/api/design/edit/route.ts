import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { Screen } from "@/lib/storage";

export const dynamic = "force-dynamic";

type DesignResponse = { designMd: string; screens: Screen[] };

const SYSTEM_PROMPT = `You are revising an existing DESIGN.md + screen wireframe set based on the user's
instruction. Return the COMPLETE updated JSON in the same shape as given, not a diff or partial excerpt,
no preamble/commentary. Preserve the Google DESIGN.md format (YAML front matter + the 8 canonical "## "
sections: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts)
and the screens' id/onClick linking unless the instruction asks to change them.

Output ONLY valid JSON, no markdown code fences, matching exactly:
{ "designMd": "...", "screens": [ { "id": "...", "name": "...", "platform": "mobile" | "web", "components": [ { "type": "...", "label": "...", "onClick": "..." } ] } ] }`;

/** Strip markdown code fences models sometimes wrap JSON in despite instructions. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function isValidDesignResponse(v: unknown): v is DesignResponse {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (typeof r.designMd !== "string" || !r.designMd.trim()) return false;
  if (!Array.isArray(r.screens) || r.screens.length === 0) return false;
  return r.screens.every((s: unknown) => {
    if (!s || typeof s !== "object") return false;
    const ss = s as Record<string, unknown>;
    return typeof ss.id === "string" && typeof ss.name === "string" && Array.isArray(ss.components);
  });
}

function buildUserMessage(designMd: string, screens: Screen[], instruction: string): string {
  return `Current DESIGN.md:\n---\n${designMd}\n---\n\nCurrent screens JSON:\n${JSON.stringify(screens)}\n\nInstruction:\n${instruction}`;
}

export async function POST(req: Request) {
  const { designMd, screens, instruction } = (await req.json()) as {
    designMd: string;
    screens: Screen[];
    instruction: string;
  };

  if (!designMd || !designMd.trim()) {
    return NextResponse.json({ error: "designMd is required" }, { status: 400 });
  }
  if (!instruction || !instruction.trim()) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  try {
    const raw = await chatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(designMd, screens ?? [], instruction) },
    ]);
    const parsed = parseJsonLoose(raw);
    if (!isValidDesignResponse(parsed)) {
      throw new Error("Model returned malformed design JSON");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
