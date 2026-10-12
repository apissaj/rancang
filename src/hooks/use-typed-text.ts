"use client";

import { useEffect, useRef, useState } from "react";

const TICK_MS = 16;

export function nextRevealCount(shownLength: number, targetLength: number): number {
  const remaining = targetLength - shownLength;
  if (remaining <= 0) return 0;
  const catchUp = remaining > 12 ? Math.ceil(remaining / 3) : 0;
  const steady = Math.max(1, Math.min(12, Math.ceil(remaining / 40)));
  return Math.min(remaining, Math.max(catchUp, steady));
}

export function useTypedText(target: string, active: boolean): string {
  const [shown, setShown] = useState("");
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    if (!active) {
      setShown("");
      return;
    }
    const id = setInterval(() => {
      const full = targetRef.current;
      setShown((prev) => {
        if (!full.startsWith(prev)) return "";
        const n = nextRevealCount(prev.length, full.length);
        return n === 0 ? prev : full.slice(0, prev.length + n);
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return target;
  return target.startsWith(shown) ? shown : "";
}
