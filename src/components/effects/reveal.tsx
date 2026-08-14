"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fade-in-up reveal.
 * - `start`: external trigger (e.g. after loader). When omitted, uses IntersectionObserver on the element itself.
 * - `delay`: stagger delay in ms.
 */
export default function Reveal({
  start,
  delay = 0,
  className = "",
  children,
}: {
  start?: boolean;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(!!start);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (start !== undefined) {
      if (start) {
        const t = setTimeout(() => setShown(true), delay);
        return () => clearTimeout(t);
      }
      return;
    }
    // Scroll-triggered mode: observe self
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [start, delay]);

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
