import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { detectAgents, getRecommendedFormat } from "@/lib/detect-agent";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(60, 60_000);

/**
 * GET /api/mcp/detect
 * Returns list of detected AI coding agents and recommended format.
 */
export async function GET(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;
  const dir = req.nextUrl.searchParams.get("dir") || process.cwd();
  const agents = detectAgents(dir);
  const recommended = getRecommendedFormat(dir);
  return NextResponse.json({
    agents,
    recommended,
    detectedCount: agents.filter((a) => a.found).length,
  });
}