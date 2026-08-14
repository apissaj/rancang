import Reveal from "@/components/effects/reveal";

const agents = [
  { src: "/brand-logos/cursor.svg", name: "Cursor" },
  { src: "/brand-logos/claude.svg", name: "Claude Code" },
  { src: "/brand-logos/opencode.svg", name: "OpenCode" },
  { src: "/brand-logos/github-copilot.svg", name: "GitHub Copilot" },
  { src: "/brand-logos/windsurf.svg", name: "Windsurf" },
  { src: "/brand-logos/n8n.svg", name: "n8n" },
];

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
          {agents.map(({ src, name }) => (
            <div
              key={name}
              className="flex items-center justify-center gap-2 rounded-sm border border-border bg-card/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <img
                src={src}
                alt={`${name} logo`}
                className="h-5 w-auto shrink-0"
                loading="lazy"
              />
              {name}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}