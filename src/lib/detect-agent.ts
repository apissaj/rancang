import fs from "fs";
import path from "path";

export interface DetectedAgent {
  name: string;
  id: string;
  found: boolean;
  indicator: string;
  preferredFormat: string;
}

/**
 * Detect AI coding tools and agents configured in the current environment / home directory.
 */
export function detectAgents(cwd = process.cwd()): DetectedAgent[] {
  const home = process.env.HOME || process.env.USERPROFILE || "";

  const checks: { id: string; name: string; format: string; paths: string[] }[] = [
    {
      id: "claude",
      name: "Claude Code",
      format: "claude",
      paths: [
        path.join(home, ".claude"),
        path.join(home, ".config", "claude"),
        path.join(cwd, "CLAUDE.md"),
      ],
    },
    {
      id: "opencode",
      name: "OpenCode",
      format: "opencode",
      paths: [
        path.join(home, ".config", "opencode", "opencode.json"),
        path.join(cwd, "opencode.md"),
      ],
    },
    {
      id: "cursor",
      name: "Cursor",
      format: "cursor",
      paths: [
        path.join(cwd, ".cursor"),
        path.join(cwd, ".cursorrules"),
        path.join(home, ".cursor"),
      ],
    },
    {
      id: "cline",
      name: "Cline / Roo Code",
      format: "cline",
      paths: [
        path.join(cwd, ".clinerules"),
        path.join(cwd, ".roomodes"),
      ],
    },
    {
      id: "windsurf",
      name: "Windsurf",
      format: "windsurf",
      paths: [
        path.join(cwd, ".windsurf"),
        path.join(cwd, ".windsurfrules"),
      ],
    },
    {
      id: "hermes",
      name: "Hermes Agent",
      format: "agents",
      paths: [
        path.join(home, "AppData", "Local", "hermes"),
        path.join(home, ".hermes"),
      ],
    },
  ];

  return checks.map((c) => {
    let found = false;
    let foundPath = "";
    for (const p of c.paths) {
      if (fs.existsSync(p)) {
        found = true;
        foundPath = p;
        break;
      }
    }
    return {
      id: c.id,
      name: c.name,
      found,
      indicator: foundPath ? path.basename(foundPath) : "",
      preferredFormat: c.format,
    };
  });
}

/**
 * Return the best-matching format based on detected agents, defaulting to "agents".
 */
export function getRecommendedFormat(cwd = process.cwd()): string {
  const agents = detectAgents(cwd);
  const detected = agents.filter((a) => a.found);
  if (detected.length === 0) return "all";
  // Priority order: claude > opencode > cursor > cline > windsurf
  const order = ["claude", "opencode", "cursor", "cline", "windsurf", "hermes"];
  for (const o of order) {
    const match = detected.find((d) => d.id === o);
    if (match) return match.preferredFormat;
  }
  return detected[0].preferredFormat;
}