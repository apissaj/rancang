"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BrandLoader } from "@/components/effects/brand-loader";

/**
 * Global brand loader.
 * - First mount (refresh/direct open): full intro 900ms pulse + 700ms fade.
 * - Every route navigation (pathname change): quick 500ms pulse + 500ms fade.
 * Pathname-aware so it deterministically plays on EVERY page switch,
 * unlike Next.js loading.tsx which only shows on slow renders.
 */
export default function LandingLoader() {
  const pathname = usePathname();
  const prevPath = useRef<string | null>(null);
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const isNav = prevPath.current !== null && prevPath.current !== pathname;
    prevPath.current = pathname;

    setHide(false);
    setGone(false);

    const pulse = isNav ? 500 : 900;
    const total = isNav ? 1000 : 1600;
    const t1 = setTimeout(() => setHide(true), pulse);
    const t2 = setTimeout(() => setGone(true), total);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [pathname]);

  if (gone) return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-background transition-opacity duration-500 ${
        hide ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <BrandLoader />
    </div>
  );
}