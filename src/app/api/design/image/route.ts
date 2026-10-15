import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { generateScreenImage } from "@/lib/image-gen";
import { extractFrontMatter, resolveTokens } from "@/lib/design-yaml";
import { saveImage } from "@/lib/image-storage";
import type { Screen } from "@/lib/storage";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const limiter = rateLimiter(10, 60_000);

type Tokens = {
  colors?: { primary?: string; secondary?: string; tertiary?: string; neutral?: string };
  typography?: { [key: string]: { fontFamily?: string } };
  rounded?: { sm?: string; md?: string; lg?: string };
};

function buildPrompt(screen: Screen, designMd: string, styleHint?: string): string {
  const front = extractFrontMatter(designMd);
  const tokens = (front ? resolveTokens(front) : {}) as unknown as Tokens;
  const colors = tokens.colors ?? {};
  const paletteBits = [colors.primary, colors.secondary, colors.tertiary, colors.neutral].filter(Boolean);
  const palette = paletteBits.length ? `color palette: ${paletteBits.join(", ")}` : "a cohesive modern color palette";
  const fontFamily = Object.values(tokens.typography ?? {}).find((t) => t?.fontFamily)?.fontFamily;
  const font = fontFamily ? `using a ${fontFamily}-style typeface` : "";
  const roundedness = tokens.rounded?.md ? `with ${tokens.rounded.md} rounded corners on cards and buttons` : "";

  const componentList = screen.components
    .map((c) => `${c.type}: ${c.label}`)
    .join(", ");

  const framing =
    screen.platform === "mobile"
      ? "framed as a single mobile phone screenshot (portrait, iPhone-style rounded device viewport)"
      : "framed as a desktop browser window screenshot (landscape, wide layout)";

  const styleBit = styleHint?.trim() ? `, ${styleHint.trim()}` : "";

  return (
    `A high-fidelity mobile/web app UI screenshot mockup, NOT a wireframe, real polished UI design, ` +
    `${palette}, clean modern SaaS/app aesthetic, no photorealistic humans needed — abstract avatar ` +
    `circles with initials are fine, no readable brand logos. The screen is titled "${screen.name}" and ` +
    `contains these elements: ${componentList}. Render it ${framing}${font ? `, ${font}` : ""}${roundedness ? `, ${roundedness}` : ""}${styleBit}.`
  );
}

export async function POST(req: NextRequest) {
  const blocked = limiter.check(req);
  if (blocked) return blocked;
  const check = await requireUid(req);
  if ("error" in check) return check.error;

  let body: {
    screen: Screen;
    designMd: string;
    styleHint?: string;
    designId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid" }, { status: 400 });
  }
  const { screen, designMd, styleHint, designId } = body;

  if (!screen || !designMd || !designId) {
    return NextResponse.json({ error: "screen, designMd and designId are required" }, { status: 400 });
  }

  try {
    const prompt = buildPrompt(screen, designMd, styleHint);
    const image = await generateScreenImage(prompt);
    const imageUrl = await saveImage(designId, screen.id, image);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    console.error("[design/image] generation failed:", err);
    const msg =
      err instanceof Error && /not configured/i.test(err.message)
        ? "Image generation belum dikonfigurasi — tambahkan IMAGE_GEN_BASE_URL & IMAGE_GEN_MODEL di .env dulu"
        : "Gagal membuat gambar desain";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
