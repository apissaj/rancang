"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight fade-in-up animation (ChatGPT-style, fast & subtle).
 * - Pure CSS transition, no animation library.
 * - `delay` for stagger.
 * - Respects prefers-reduced-motion (no movement, only opacity fade).
 */
export function FadeInUp({
  delay = 0,
  className = "",
  style,
  children,
}: {
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Respect reduced motion: show instantly (no animation)
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-300 ease-out will-change-transform",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        className
      )}
      style={{ ...style, transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
