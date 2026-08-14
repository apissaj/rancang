import { ChevronDown } from "lucide-react";
import Reveal from "@/components/effects/reveal";

const faqs = [
  {
    q: "Butuh API key sendiri?",
    a: "Tidak wajib. Rancang jalan lewat gateway LLM milikmu (9Router/ZenProxy) yang sudah dikonfigurasi. Tinggal pilih model dan pakai — tanpa akun, tanpa kartu kredit.",
  },
  {
    q: "Apa bedanya sama nulis PRD manual?",
    a: "PRD manual makan 1-2 jam nulis struktur, user story, dan task breakdown. Rancang menyusun semuanya dari ide kasar dalam hitungan detik, dengan format konsisten yang siap dipakai coding agent.",
  },
  {
    q: "Data saya aman nggak?",
    a: "Semua data tersimpan di browser kamu (localStorage). Nggak ada database, nggak ada server yang nyimpen ide atau PRD kamu — kecuali kamu ekspor sendiri.",
  },
  {
    q: "Hasilnya bisa dipakai di coding agent apa aja?",
    a: "Output-nya markdown murni: PRD, DESIGN.md, dan tasks. Bisa langsung di-paste ke Cursor, Claude Code, OpenCode, GitHub Copilot, atau agent lain yang bisa baca markdown.",
  },
];

export default function FAQ() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bantuan
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Pertanyaan yang sering diajukan
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 outline-none select-none">
                <span className="text-base font-medium text-foreground">{q}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}