import Reveal from "@/components/effects/reveal";
import { FileText, FileCode2, FileCog, FileCheck2, ChevronRight, ChevronDown } from "lucide-react";

const files = [
  { name: "PRD.md", icon: FileText, active: true },
  { name: "DESIGN.md", icon: FileCode2, active: false },
  { name: "TASKS.md", icon: FileCog, active: false },
  { name: "PLAN.md", icon: FileCheck2, active: false },
];

const tabs = ["PRD.md", "DESIGN.md", "TASKS.md", "PLAN.md"];

// line: nomor baris, content: teks, kind: heading1|heading2|list|body
const lines = [
  { no: 1, kind: "heading1", text: "# PRD: Aplikasi Todo Kolaboratif" },
  { no: 2, kind: "blank", text: "" },
  { no: 3, kind: "heading2", text: "## 1. Executive Summary" },
  { no: 4, kind: "body", text: "Aplikasi todo lintas perangkat dengan real-time" },
  { no: 5, kind: "body", text: "sync dan kolaborasi antar anggota tim." },
  { no: 6, kind: "blank", text: "" },
  { no: 7, kind: "heading2", text: "## 2. User Stories" },
  { no: 8, kind: "list", text: "US-01: Buat, hapus, dan edit task" },
  { no: 9, kind: "list", text: "US-02: Bagikan daftar ke anggota tim" },
  { no: 10, kind: "list", text: "US-03: Terima update real-time" },
  { no: 11, kind: "blank", text: "" },
  { no: 12, kind: "heading2", text: "## 3. System Scope" },
  { no: 13, kind: "list", text: "Web app + API + real-time server" },
  { no: 14, kind: "blank", text: "" },
  { no: 15, kind: "heading2", text: "## 4. Task Breakdown (T-01..T-12)" },
  { no: 16, kind: "list", text: "T-01: Scaffold Next.js + database schema" },
  { no: 17, kind: "list", text: "T-02: Auth dengan Google OAuth" },
];

const lineClass = (kind: string) => {
  switch (kind) {
    case "heading1":
      return "text-foreground font-semibold";
    case "heading2":
      return "text-foreground/90 font-medium";
    case "list":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/70";
  }
};

export default function BlueprintPreview() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Output
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Satu ide, blueprint lengkap
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Contoh nyata output dari satu kalimat ide
          </p>
        </div>

        {/* VSCode-style window */}
        <div className="overflow-hidden rounded-sm border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          {/* macOS title bar */}
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#FF5F56]" />
              <span className="size-3 rounded-full bg-[#FFBD2E]" />
              <span className="size-3 rounded-full bg-[#27C93F]" />
            </div>
            <span className="ml-3 truncate font-mono text-xs text-muted-foreground">
              PRD.md — Rancang
            </span>
          </div>

          {/* Tab bar */}
          <div className="flex items-end overflow-x-auto border-b border-border bg-muted/20">
            {tabs.map((tab, i) => {
              const Icon = files[i]?.icon ?? FileText;
              return (
                <div
                  key={tab}
                  className={
                    i === 0
                      ? "flex items-center gap-1.5 border-r border-border bg-card px-4 py-2 font-mono text-xs text-foreground"
                      : "flex items-center gap-1.5 border-r border-border px-4 py-2 font-mono text-xs text-muted-foreground/70"
                  }
                >
                  <Icon className="size-3.5 shrink-0" />
                  {tab}
                </div>
              );
            })}
          </div>

          {/* Body: sidebar + editor */}
          <div className="flex">
            {/* Explorer sidebar */}
            <div className="hidden w-44 shrink-0 border-r border-border bg-muted/20 sm:block">
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Explorer
              </div>
              <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                <ChevronDown className="size-3.5" />
                rancang
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 pl-6 text-xs text-muted-foreground">
                <ChevronDown className="size-3.5" />
                docs
              </div>
              {files.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.name}
                    className={
                      f.active
                        ? "flex items-center gap-1.5 border-l-2 border-foreground bg-muted/60 px-2 py-1 pl-6 font-mono text-xs text-foreground"
                        : "flex items-center gap-1.5 px-2 py-1 pl-6 font-mono text-xs text-muted-foreground/70"
                    }
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {f.name}
                  </div>
                );
              })}
            </div>

            {/* Editor */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              <div className="min-w-[420px] p-3 font-mono text-xs leading-6 sm:text-[13px]">
                {lines.map((line) => (
                  <div key={line.no} className="flex">
                    <span className="w-8 shrink-0 select-none pr-3 text-right text-[10px] leading-6 text-muted-foreground/40">
                      {line.no}
                    </span>
                    <span
                      className={`whitespace-pre ${lineClass(line.kind)}`}
                    >
                      {line.text || "\u00A0"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-1.5 font-mono text-[10px] text-muted-foreground/70">
            <span className="flex items-center gap-1">
              <ChevronRight className="size-3" /> main
            </span>
            <span>Ln 17, Col 1</span>
            <span>Spaces: 2</span>
            <span className="ml-auto hidden sm:inline">UTF-8</span>
            <span>Markdown</span>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          PRD, spesifikasi, rencana teknis, dan task bernomor — streaming
          langsung, siap diunduh sebagai markdown.
        </p>
      </Reveal>
    </section>
  );
}