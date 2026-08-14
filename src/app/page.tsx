"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MessagesSquare, FileText, Palette, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import LandingLoader from "@/components/effects/landing-loader";
import Reveal from "@/components/effects/reveal";
import HeroBand from "@/components/effects/hero-band";
import HowItWorks from "@/components/effects/how-it-works";
import Integrations from "@/components/effects/integrations";
import Testimonials from "@/components/effects/testimonials";
import BlueprintPreview from "@/components/effects/blueprint-preview";
import Pricing from "@/components/effects/pricing";
import FAQ from "@/components/effects/faq";
import CTASection from "@/components/effects/cta-section";
import Footer from "@/components/layout/footer";

const tools = [
  {
    href: "/chat",
    icon: MessagesSquare,
    title: "Chat Multi-Model",
    description:
      "Ngobrol dengan model apa pun yang terkonfigurasi, atau aktifkan mode banding untuk menjalankan prompt yang sama di 2–3 model sekaligus dan lihat responsnya streaming berdampingan.",
    cta: "Buka chat",
  },
  {
    href: "/plan",
    icon: FileText,
    title: "Generator PRD",
    description:
      "Jelaskan ide aplikasi atau fitur, dapatkan PRD lengkap: tujuan, user story, kebutuhan, dan rincian task bernomor yang siap dipakai AI coding agent.",
    cta: "Buat PRD",
  },
  {
    href: "/design",
    icon: Palette,
    title: "Generator Desain",
    description:
      "Ubah ide jadi spesifikasi token DESIGN.md plus prototipe wireframe yang bisa diklik, siap dijadikan mockup hi-fi.",
    cta: "Buat desain",
  },
  {
    href: "/plan",
    icon: Cpu,
    title: "Gateway Sendiri",
    description:
      "Semua jalan lewat gateway LLM milikmu. Tanpa akun, tanpa database, data tersimpan aman di browser.",
    cta: "Mulai",
  },
];

export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <LandingLoader />
      <div
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16 transition-opacity duration-700 sm:py-24"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {/* Hero: asymmetric, heavy left column */}
        <section className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <Reveal start={ready} delay={100}>
              <p className="mb-4 inline-flex items-center gap-2 rounded-sm border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                Rancang
              </p>
            </Reveal>
            <Reveal start={ready} delay={200}>
              <h1 className="mt-4 text-5xl font-bold tracking-tighter text-balance text-foreground sm:text-6xl lg:text-7xl">
                Ubah ide jadi blueprint, siap dikerjakan AI.
              </h1>
            </Reveal>
            <Reveal start={ready} delay={300}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Chat dengan beberapa model berdampingan, atau ubah ide kasar jadi PRD
                terstruktur siap-agent dalam hitungan detik. Semuanya lewat gateway LLM
                milikmu sendiri dan tersimpan di browser. Tanpa akun, tanpa database.
              </p>
            </Reveal>
            <Reveal start={ready} delay={400}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button render={<Link href="/plan" />} className="h-11 px-6 text-base">
                  Buat PRD
                </Button>
                <Button
                  variant="outline"
                  render={<Link href="/chat" />}
                  className="h-11 px-6 text-base"
                >
                  Buka chat
                </Button>
              </div>
            </Reveal>
          </div>

          {/* Right visual: flat-bordered preview card */}
          <div className="flex items-center lg:col-span-5">
            <Reveal start={ready} delay={350} className="w-full">
              <div className="w-full rounded-sm border border-border bg-card/60 p-6">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Alur kerja
                  </span>
                  <span className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-muted-foreground/30" />
                    <span className="size-2 rounded-full bg-muted-foreground/30" />
                    <span className="size-2 rounded-full bg-muted-foreground/30" />
                  </span>
                </div>
                <ol className="mt-4 space-y-3">
                  {[
                    "Tulis ide kasar dalam satu kalimat",
                    "Jawab 5 pertanyaan konteks (atau lewati)",
                    "Dapatkan PRD, spec, plan, dan tasks streaming",
                    "Ekspor markdown ke coding agent mana pun",
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border border-border text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="leading-snug text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Tools: 4-column grid, flat borders */}
        <section className="mt-20 sm:mt-28">
          <Reveal start={ready} delay={450}>
            <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fitur
                </div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  Terintegrasi dengan alur kerja kamu
                </h2>
              </div>
              <span className="hidden text-sm text-muted-foreground sm:block">Semua lewat gateway kamu</span>
            </div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {tools.map(({ href, icon: Icon, title, description, cta }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex flex-col bg-background p-6 transition-colors hover:bg-muted/60"
                >
                  <Icon className="size-5 text-muted-foreground transition-transform duration-300 group-hover:scale-110" />
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                    {cta}
                    <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </section>

        <HowItWorks />
        <Integrations />
        <BlueprintPreview />
        <Testimonials />
        <Pricing />
        <FAQ />
        <HeroBand />
        <CTASection />
      </div>
      <Footer />
    </>
  );
}
