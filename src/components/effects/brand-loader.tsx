"use client";

import { Hammer } from "lucide-react";

/**
 * Brand loader (logo + name). Used by:
 * - landing-loader.tsx (full-screen intro on first mount)
 * - loading.tsx route files (Next.js native loading UI on navigation)
 */
export function BrandLoader() {
  return (
    <div
      aria-hidden
      className="flex flex-col items-center gap-4"
    >
      <div className="flex size-12 items-center justify-center rounded-sm border border-border">
        <Hammer className="size-7 text-foreground [animation:loader-pulse_1.8s_ease-in-out_infinite]" />
      </div>
      <span className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
        Rancang
      </span>
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
