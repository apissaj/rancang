"use client";

import { Bot, Cpu, FileCode2, Terminal } from "lucide-react";
import type { ExecTab } from "@/lib/projects";

const EXEC_TABS: { id: ExecTab; label: string; icon: typeof Terminal }[] = [
  { id: "opencode", label: "OpenCode", icon: Bot },
  { id: "claude-code", label: "Claude Code", icon: FileCode2 },
  { id: "hermes", label: "Hermes", icon: Cpu },
  { id: "direct", label: "Terminal", icon: Terminal },
];

export function ExecTabSelector({ value, onChange }: { value: ExecTab; onChange: (tab: ExecTab) => void }) {
  return (
    <div className="mt-8 flex items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground">Perintah Eksekusi:</span>
      <div className="flex gap-1 rounded-lg border bg-muted/30 p-0.5">
        {EXEC_TABS.map((t) => {
          const Icon = t.icon;
          const active = value === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
