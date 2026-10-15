"use client";

import { useEffect, useState } from "react";

const GENERATION_STAGE_LABELS = [
  "Composing prompt from your design tokens...",
  "Rendering UI mockup...",
  "Finalizing image...",
];

// Estimated (not real) progress: no streaming signal from the image gateway, so this is a
// client-side asymptotic curve calibrated against a ~50-58s typical generation time.
export function GenerationProgress({ startedAt, justSucceeded }: { startedAt: number; justSucceeded: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
  const progress = justSucceeded ? 100 : Math.min(99, 100 * (1 - Math.exp(-elapsedSeconds / 25)));
  const stageLabel = GENERATION_STAGE_LABELS[Math.floor(elapsedSeconds / 5) % GENERATION_STAGE_LABELS.length];
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {Math.floor(elapsedSeconds)}s &middot; {stageLabel}
      </p>
    </div>
  );
}
