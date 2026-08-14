import { FileText, MessageSquareText, Sparkles } from "lucide-react";
import Reveal from "@/components/effects/reveal";

const steps = [
  {
    icon: MessageSquareText,
    title: "Tulis ide",
    desc: "Cukup satu kalimat kasar. 'Buat aplikasi todo list dengan fitur kolaborasi' — selesai, nggak perlu format khusus.",
  },
  {
    icon: FileText,
    title: "Jawab konteks",
    desc: "Lima pertanyaan singkat atau lewati saja. Rancang butuh cukup konteks untuk menyusun PRD yang relevan.",
  },
  {
    icon: Sparkles,
    title: "Dapatkan blueprint",
    desc: "PRD, spesifikasi, rencana teknis, dan task bernomor — streaming langsung, siap dikerjakan coding agent mana pun.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Cara kerja
          </h2>
          <span className="text-sm text-muted-foreground">Tiga langkah</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex flex-col bg-background p-6 sm:p-8">
              <span className="mb-4 flex size-10 items-center justify-center rounded-sm border border-border bg-muted">
                <Icon className="size-5 text-foreground" />
              </span>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
              <span className="mt-6 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Langkah {i + 1} dari 3
              </span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}