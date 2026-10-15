import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { mcpGuard } from "@/lib/mcp-guard";
import { detectAgents, getRecommendedFormat } from "@/lib/detect-agent";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(60, 60_000);

/**
 * Resolve the `dir` query param to a scan target accepted by this route.
 * Only a real directory that lives inside the server working directory or the
 * user's home directory is allowed (the two roots the CLI legitimately scans);
 * anything else falls back to process.cwd(). This keeps the route to its
 * intended use (scan a project folder for AI agents) and blocks probing of
 * arbitrary system paths elsewhere on disk.
 */
function tryRealpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return "";
  }
}

function resolveScanDir(raw: string | null): string {
  const root = process.cwd();
  if (!raw) return root;
  const resolved = tryRealpath(path.resolve(raw));
  if (!resolved || !isDir(resolved)) return root;
  // Allowlist: inside cwd or inside the user's home (the roots the CLI scans).
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const allowed = [tryRealpath(root), tryRealpath(home)].filter(Boolean);
  const within = allowed.some((r) => resolved === r || resolved.startsWith(r + path.sep));
  return within ? resolved : root;
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * GET /api/mcp/detect
 * Returns list of detected AI coding agents and recommended format.
 */
export async function GET(req: NextRequest) {
  const blocked = mcpGuard();
  if (blocked) return blocked;
  const limited = limiter.check(req);
  if (limited) return limited;
  const dir = resolveScanDir(req.nextUrl.searchParams.get("dir"));
  const agents = detectAgents(dir);
  const recommended = getRecommendedFormat(dir);
  return NextResponse.json({
    agents,
    recommended,
    detectedCount: agents.filter((a) => a.found).length,
    scanned: dir,
  });
}