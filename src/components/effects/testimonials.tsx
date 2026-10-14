import Reveal from "@/components/effects/reveal";
import { MessageSquareText, FileText, Copy } from "lucide-react";

const scenarios = [
  {
    icon: FileText,
    title: "Dari ide ke PRD",
    desc: "Tulis satu kalimat ide di /plan. PRD, spesifikasi, rencana, dan tasks bernomor muncul streaming langsung di editor.",
    path: "/plan",
  },
  {
    icon: MessageSquareText,
    title: "Klarifikasi, lalu lewati",
    desc: "Jawab pertanyaan klarifikasi untuk memperkaya konteks, atau pilih \"Lewati, langsung buat\" kalau ingin langsung generate.",
    path: "/plan",
  },
  {
    icon: Copy,
    title: "Salin ke coding agent",
    desc: "Salin markdown per dokumen, atau \"Salin Prompt MCP\" untuk ditempel ke agent. Agent yang tersambung MCP bisa menarik blueprint sendiri.",
    path: "/plan",
  },
];

export default function Testimonials() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Dipakai untuk
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Tiga alur yang bisa kamu jalankan sekarang
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Setiap alur memakai fitur yang sudah ada di aplikasi.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenarios.map(({ icon: Icon, title, desc, path }, i) => (
            <article
              key={title}
              className="relative flex flex-col justify-between rounded-sm border border-border bg-card/60 p-5 transition-colors hover:border-foreground/40 hover:bg-muted/40"
            >
              <div>
                <span className="mb-4 flex size-10 items-center justify-center rounded-sm border border-border bg-muted">
                  <Icon className="size-5 text-foreground" />
                </span>
                <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Alur {i + 1} dari 3</span>
                <span className="font-mono normal-case tracking-normal">{path}</span>
              </div>
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
