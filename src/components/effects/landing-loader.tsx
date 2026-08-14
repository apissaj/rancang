"use client";

import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";

export default function LandingLoader() {
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setHide(true), 900);
    const t2 = setTimeout(() => setGone(true), 1600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        hide ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-12 items-center justify-center rounded-sm border border-border">
          <Hammer className="size-7 text-foreground [animation:loader-pulse_1.8s_ease-in-out_infinite]" />
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Rancang
        </span>
      </div>
      <style>{`
        @keyframes loader-pulse {
          0%, 100% { opacity: 0.35; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="loader-pulse"] { animation: none !important; opacity: 1; }
        }
      `}</style>
    </div>
  );
}