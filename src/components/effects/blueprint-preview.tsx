import Reveal from "@/components/effects/reveal";

const blueprintLines = [
  { depth: 0, text: "# PRD: Aplikasi Todo Kolaboratif" },
  { depth: 0, text: "" },
  { depth: 0, text: "## 1. Executive Summary" },
  { depth: 1, text: "Aplikasi todo lintas perangkat dengan real-time sync" },
  { depth: 1, text: "dan kolaborasi antar anggota tim." },
  { depth: 0, text: "" },
  { depth: 0, text: "## 2. User Stories" },
  { depth: 1, text: "US-01: Buat, hapus, dan edit task" },
  { depth: 1, text: "US-02: Bagikan daftar ke anggota tim" },
  { depth: 1, text: "US-03: Terima update real-time" },
  { depth: 0, text: "" },
  { depth: 0, text: "## 3. System Scope" },
  { depth: 1, text: "Web app + API + real-time server" },
  { depth: 0, text: "" },
  { depth: 0, text: "## 4. Task Breakdown (T-01..T-12)" },
  { depth: 1, text: "T-01: Scaffold Next.js + database schema" },
  { depth: 1, text: "T-02: Auth dengan Google OAuth" },
  { depth: 1, text: "T-03: CRUD endpoint untuk tasks" },
];

export default function BlueprintPreview() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Lihat blueprint-nya seperti apa
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Contoh nyata output dari satu kalimat ide
          </p>
        </div>
        <div className="overflow-hidden rounded-sm border border-border bg-card/60">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
              <span className="size-2.5 rounded-full bg-muted" />
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              PRD.md
            </span>
          </div>
          <div className="p-4 font-mono text-xs leading-relaxed sm:text-[13px]">
            {blueprintLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.depth === 0
                    ? "text-foreground"
                    : i % 2 === 0
                      ? "text-muted-foreground"
                      : "text-muted-foreground/80"
                }
                style={{ paddingLeft: `${line.depth * 1.25}rem` }}
              >
                {line.text || "\u00A0"}
              </div>
            ))}
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