import { NextRequest, NextResponse } from "next/server";
import { detectAgents, getRecommendedFormat } from "@/lib/detect-agent";

export const dynamic = "force-dynamic";

/**
 * GET /api/mcp/detect
 * Returns list of detected AI coding agents and recommended format.
 */
export async function GET(req: NextRequest) {
  const dir = req.nextUrl.searchParams.get("dir") || process.cwd();
  const agents = detectAgents(dir);
  const recommended = getRecommendedFormat(dir);
  return NextResponse.json({
    agents,
    recommended,
    detectedCount: agents.filter((a) => a.found).length,
  });
}