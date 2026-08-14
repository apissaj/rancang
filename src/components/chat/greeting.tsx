"use client";

import { Hammer } from "lucide-react";
import { FadeInUp } from "@/components/effects/fade-in-up";

const suggestions = [
  "Buat aplikasi todo list dengan fitur kolaborasi",
  "PRD untuk marketplace jasa desain",
  "Chat multi-model untuk dukungan pelanggan",
  "Rencana teknis untuk aplikasi mobile POS",
];

export function Greeting({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center px-4 text-center">
      <FadeInUp delay={0}>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/40">
          <Hammer className="h-6 w-6 text-foreground" />
        </div>
      </FadeInUp>
      <FadeInUp delay={60}>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          Ada yang bisa dirancang hari ini?
        </h2>
      </FadeInUp>
      <FadeInUp delay={120}>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Tulis idemu, ubah jadi blueprint. Pilih contoh di bawah atau ketik langsung.
        </p>
      </FadeInUp>
      <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s, i) => (
          <FadeInUp key={s} delay={180 + i * 50}>
            <button
              onClick={() => onPick(s)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {s}
            </button>
          </FadeInUp>
        ))}
      </div>
    </div>
  );
}