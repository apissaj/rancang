import Reveal from "@/components/effects/reveal";
import { BrandLogo } from "@/components/effects/brand-logo";

const agents = [
  { brand: "cursor", name: "Cursor" },
  { brand: "claude", name: "Claude Code" },
  { brand: "opencode", name: "OpenCode" },
  { brand: "githubcopilot", name: "GitHub Copilot" },
  { brand: "windsurf", name: "Windsurf" },
  { brand: "n8n", name: "n8n" },
] as const;

export default function Integrations() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Kompatibel dengan coding agent favoritmu
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ekspor blueprint ke markdown — jalan di agent mana pun
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {agents.map(({ brand, name }) => (
            <div
              key={name}
              className="flex items-center justify-center gap-2 rounded-sm border border-border bg-card/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <BrandLogo brand={brand} className="size-6 shrink-0" />
              {name}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}