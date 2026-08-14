import { NextResponse } from "next/server";
import { chatCompletion } from "@/lib/llm";
import { getDefaultModel } from "@/lib/models";
import type { Screen } from "@/lib/storage";

export const dynamic = "force-dynamic";

type DesignResponse = { designMd: string; screens: Screen[] };

const SYSTEM_PROMPT = `You are a senior product designer producing a DESIGN.md design-token spec plus a
clickable wireframe prototype, given an app idea (and optionally its full PRD for context).

Output ONLY valid JSON, no markdown code fences, no commentary, matching exactly this shape:
{
  "designMd": "<the full DESIGN.md file content as a single string>",
  "screens": [ { "id": "...", "name": "...", "platform": "mobile" | "web", "components": [ { "type": "...", "label": "...", "onClick": "target-screen-id" } ] } ]
}

designMd MUST be Google's open DESIGN.md format: YAML front matter followed by a Markdown body with
EXACTLY these "## " headings, in this order: Overview, Colors, Typography, Layout, Elevation & Depth,
Shapes, Components, Do's and Don'ts.

Front matter rules:
- version: alpha
- name: <design name>, description: <one line>
- colors: primary, secondary, tertiary, neutral as quoted hex strings, e.g. "#1A1C1E"
  COLOR ROLE DISCIPLINE (critical — this is the #1 cause of unreadable mockups, follow strictly):
  - "neutral" is the dominant SURFACE color (page/card background) — pick a near-white (light theme)
    or near-black (dark theme) value. It is NEVER used as a text or accent color.
  - "primary"/"secondary"/"tertiary" are ACCENT colors used SPARINGLY — for buttons, active states,
    icons, borders, and highlights only. They are NOT used for body text, paragraphs, or large blocks
    of readable content — regular text must always read clearly against "neutral" (near-black text on
    a light neutral, or near-white text on a dark neutral), never in a bright accent hue.
  - Every accent color MUST have strong contrast against both white (#FFFFFF) text and black (#000000)
    text for at least one of them (WCAG AA, 4.5:1+) — avoid pastel/light accents like yellow or light
    orange as a button background with white text on top (classic failure: light-yellow bg + white
    text is unreadable). If in doubt, use a darker, more saturated shade of the accent for anything
    text sits on top of.
  - Pick ONE overall theme (light OR dark), not a mix — neutral sets the theme, don't fight it with
    text colors from the opposite theme.
- typography: named styles (h1, h2, body-md, etc.) each an inline map: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
- rounded: sm/md/lg px values
- spacing: sm/md/lg px values
- components: named component tokens (e.g. button-primary) as nested maps referencing other tokens with
  "{colors.primary}" dotted-path syntax; hover/active variants are separate SIBLING keys like
  button-primary-hover, never nested inside the base component. Every component with a background color
  MUST also define a "text" color chosen for contrast against that background (do not default to white).

In the "## Layout" section, note responsive breakpoints if platform is "both". If pwa is true, add
manifest/service-worker/installable guidance to "## Overview" or "## Do's and Don'ts".

screens: produce 4-8 screens covering the idea's core user flows, each with 5-10 components using ONLY
these types: header, text, button, input, list-item, card, nav-item, image-placeholder, divider.
Components that navigate to another screen MUST set "onClick" to that screen's "id". If platform is
"both", generate the SAME logical screens twice: once with platform:"mobile" and ids like "home-mobile",
once with platform:"web" and ids like "home-web" — each set's onClick targets must point only within its
own platform's ids. If platform is "mobile" or "web" only, generate just that platform's screens.

Output only the JSON object.`;

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
    return (
      typeof ss.id === "string" &&
      typeof ss.name === "string" &&
      (ss.platform === "mobile" || ss.platform === "web") &&
      Array.isArray(ss.components)
    );
  });
}

function buildUserMessage(idea: string, planMarkdown: string | undefined, vibe: string | undefined, platform: string, pwa: boolean): string {
  const lines = [`Idea: ${idea}`, `Platform: ${platform}`, `PWA: ${pwa}`];
  if (vibe?.trim()) lines.push(`Vibe: ${vibe}`);
  if (planMarkdown?.trim()) lines.push(`\nFull PRD for context:\n---\n${planMarkdown}\n---`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const { idea, planMarkdown, vibe, platform, pwa } = (await req.json()) as {
    idea: string;
    planMarkdown?: string;
    vibe?: string;
    platform: "mobile" | "web" | "both";
    pwa: boolean;
  };

  if (!idea || !idea.trim()) {
    return NextResponse.json({ error: "idea is required" }, { status: 400 });
  }
  if (platform !== "mobile" && platform !== "web" && platform !== "both") {
    return NextResponse.json({ error: "platform must be mobile, web, or both" }, { status: 400 });
  }

  try {
    const raw = await chatCompletion(getDefaultModel(), [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(idea, planMarkdown, vibe, platform, !!pwa) },
    ]);
    const parsed = parseJsonLoose(raw);
    if (!isValidDesignResponse(parsed)) {
      throw new Error("Model returned malformed design JSON");
    }
    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Kesalahan tidak diketahui";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
