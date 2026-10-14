import Reveal from "@/components/effects/reveal";
import { Check, Minus } from "lucide-react";

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  limits?: string[];
  note?: string;
  cta: string;
  href?: string;
};

const plans: Plan[] = [
  {
    name: "Gratis",
    price: "Rp0",
    period: "selamanya",
    description: "Self-host di mesin kamu sendiri. Fitur dasar tersedia.",
    features: [
      "Semua generator: PRD, desain",
      "MCP server untuk coding agent",
      "Gateway LLM kamu sendiri",
      "Data 100% di browser",
      "Mode tanpa akun: data disimpan di browser (tanpa Firebase)",
    ],
    limits: [
      "Riwayat 20 rencana dan 20 desain di browser. Yang lebih lama otomatis terhapus.",
      "Ide maksimal 10.000 karakter per permintaan.",
      "Generate PRD: 10 permintaan per menit per IP.",
      "Klarifikasi: 30 permintaan per menit per IP.",
      "Generator desain: 20 permintaan per menit per IP.",
      "MCP: 60 permintaan per menit, maksimal 200.000 karakter per dokumen dan 800.000 karakter per blueprint.",
    ],
    note: "Batas request tersimpan di memori server, jadi reset saat server dimulai ulang.",
    cta: "Mulai gratis",
    href: "/plan",
  },
  {
    name: "Pro",
    price: "Segera hadir",
    period: "",
    description: "Paket berbayar untuk pengguna lanjutan. Belum tersedia.",
    features: [
      "Semua yang ada di Gratis",
      "Sinkronisasi cloud lewat login Google",
      "Ekspor blueprint ke MCP server",
    ],
    note: "Sinkronisasi dan ekspor MCP sudah ada di kode saat ini sebagai pembanding.",
    cta: "Segera hadir",
  },
  {
    name: "Tim",
    price: "Segera hadir",
    period: "",
    description: "Untuk tim. Belum tersedia.",
    features: [],
    note: "Belum ada fitur khusus tim di kode saat ini.",
    cta: "Segera hadir",
  },
];

export default function Pricing() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Harga
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Mulai gratis, paket berbayar belum tersedia
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Versi gratis berisi semua fitur dasar dengan batasan yang tertulis di bawah.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="flex flex-col rounded-sm border border-border bg-card p-6 transition-colors hover:bg-muted/60"
            >
              <div className="text-sm font-medium text-foreground">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                )}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
              {plan.features.length > 0 && (
                <ul className="mt-5 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {plan.limits && (
                <div className="mt-5 flex-1">
                  <div className="text-sm font-medium text-foreground">Batasan</div>
                  <ul className="mt-2 space-y-2.5">
                    {plan.limits.map((l) => (
                      <li key={l} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.note && (
                <p className="mt-4 text-xs text-muted-foreground">{plan.note}</p>
              )}
              {plan.href ? (
                <a
                  href={plan.href}
                  className="mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  {plan.cta}
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-6 inline-flex cursor-not-allowed items-center justify-center rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground"
                >
                  {plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Paket berbayar belum tersedia: belum ada sistem pembayaran di kode ini. Self-hosted = bayar sesuai kemampuan. Kode sumber terbuka di GitHub.
        </p>
      </Reveal>
    </section>
  );
}
