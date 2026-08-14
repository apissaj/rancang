import Reveal from "@/components/effects/reveal";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Gratis",
    price: "Rp0",
    period: "selamanya",
    description: "Self-host di mesin kamu sendiri, semua fitur dasar.",
    features: [
      "Semua generator: PRD, desain, chat",
      "Mode banding multi-model",
      "Gateway LLM kamu sendiri",
      "Data 100% di browser",
      "Tanpa akun, tanpa database",
    ],
    cta: "Mulai gratis",
    href: "/plan",
    highlight: true,
  },
  {
    name: "Pro",
    price: "Rp99rb",
    period: "/bulan",
    description: "Untuk yang mau update terjadwal & dukungan langsung.",
    features: [
      "Semua fitur Gratis",
      "Update & rilis otomatis",
      "Dukungan via Discord",
      "Akses awal fitur beta",
      "Prioritas request fitur",
    ],
    cta: "Pilih Pro",
    href: "/chat",
    highlight: false,
  },
  {
    name: "Tim",
    price: "Custom",
    period: "",
    description: "Untuk tim yang butuh deployment terkelola.",
    features: [
      "Semua fitur Pro",
      "Deployment terkelola",
      "SSO & manajemen anggota",
      "SLA & backup",
      "Onboarding khusus",
    ],
    cta: "Hubungi kami",
    href: "/chat",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="mb-8 border-b border-border pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Harga sederhana dan transparan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Mulai gratis, upgrade kalau butuh lebih
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={
                plan.highlight
                  ? "flex flex-col rounded-sm border border-foreground bg-card p-6"
                  : "flex flex-col rounded-sm border border-border bg-card/60 p-6 transition-colors hover:bg-muted/60"
              }
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
              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={
                  plan.highlight
                    ? "mt-6 inline-flex items-center justify-center rounded-sm bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                    : "mt-6 inline-flex items-center justify-center rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                }
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Self-hosted = bayar sesuai kemampuan. Kode sumber terbuka di GitHub.
        </p>
      </Reveal>
    </section>
  );
}