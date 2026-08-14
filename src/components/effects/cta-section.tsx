import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Reveal from "@/components/effects/reveal";

export default function CTASection() {
  return (
    <section className="mt-20 sm:mt-28">
      <Reveal>
        <div className="relative overflow-hidden rounded-sm border border-border bg-card/60 px-8 py-14 sm:px-14">
          {/* subtle radial glow (pure CSS, no canvas) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 90% at 50% 100%, rgba(148,163,184,0.14), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tighter text-balance text-foreground sm:text-4xl">
              Berhenti menulis PRD dari nol.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Tulis ide kasar, biarkan Rancang menyusun PRD, spesifikasi, rencana,
              dan tasks — siap dikerjakan coding agent apa pun. Gratis, tanpa akun.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button render={<Link href="/plan" />} className="h-12 px-8 text-base">
                Mulai rancang
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button
                variant="outline"
                render={<Link href="/chat" />}
                className="h-12 px-8 text-base"
              >
                Buka chat
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
