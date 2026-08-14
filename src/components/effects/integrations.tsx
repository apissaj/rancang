import { Terminal, Code2, Bot, GitBranch, Workflow } from "lucide-react";
import Reveal from "@/components/effects/reveal";

const agents = [
  { icon: Terminal, name: "Cursor" },
  { icon: Bot, name: "Claude Code" },
  { icon: Code2, name: "OpenCode" },
  { icon: Bot, name: "GitHub Copilot" },
  { icon: GitBranch, name: "Windsurf" },
  { icon: Workflow, name: "n8n" },
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
          {agents.map(({ icon: Icon, name }) => (
            <div
              key={name}
              className="flex items-center justify-center gap-2 rounded-sm border border-border bg-card/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Icon className="size-4" />
              {name}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}