import type { DesignVersion, Screen } from "@/lib/storage";

export type Platform = "mobile" | "web" | "both";

/**
 * The blueprint-friendly design document published to the MCP bridge: the
 * DESIGN.md token spec plus the wireframe screen/component tree, so a coding
 * agent gets BOTH the visual system and the flows — not just prose.
 */
export function buildDesignDoc(designMd: string, screens: Screen[]): string {
  const parts: string[] = [];
  parts.push(designMd.trim());
  parts.push("");
  parts.push("---");
  parts.push("");
  parts.push("## Wireframe: Screens & Flow");
  parts.push("");
  parts.push(
    "Implement the screens below exactly: same names, same components, same navigation targets (the `-> screen-id` on a component is the tap destination)."
  );
  parts.push("");
  if (screens.length === 0) {
    parts.push("(no wireframe screens generated)");
    return parts.join("\n");
  }
  for (const s of screens) {
    parts.push(`### ${s.name} [${s.platform}]`);
    parts.push(`- screen-id: \`${s.id}\``);
    if (s.components.length === 0) {
      parts.push("- (empty screen)");
    } else {
      parts.push("- components:");
      for (const c of s.components) {
        parts.push(`  - **${c.type}** "${c.label}"${c.onClick ? `  -> \`${c.onClick}\`` : ""}`);
      }
    }
    parts.push("");
  }
  return parts.join("\n");
}

export function versionLabel(v: DesignVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Generated" : v.source === "manual-edit" ? "Manual edit" : "AI edit";
  return `v${index + 1} · ${sourceLabel}`;
}
