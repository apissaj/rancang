"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * LandingBackground — background layer for the landing page.
 *
 * Primary layer: `public/hero-bg.webp` (AI-generated, see the Gemini prompt in
 * the repo notes) rendered full-bleed with a dark overlay so hero text stays
 * readable on both themes. If the file is not present yet, the component
 * gracefully falls back to the old soft gradient blobs instead of showing a
 * broken image.
 */
export default function LandingBackground() {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {!imageFailed && (
        <>
          <Image
            src="/hero-bg.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
            quality={80}
            onError={() => setImageFailed(true)}
          />
          {/* Scrim: keeps text readable and blends the image edge into the theme. */}
          <div className="absolute inset-0 bg-linear-to-b from-background/80 via-background/55 to-background" />
        </>
      )}

      {imageFailed && (
        <>
          {/* Soft blue blob — top right */}
          <div
            className="absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-25 dark:opacity-20"
            style={{
              background:
                "radial-gradient(circle at center, rgba(59,130,246,0.35) 0%, transparent 62%)",
              filter: "blur(90px)",
            }}
          />
          {/* Soft indigo blob — center left */}
          <div
            className="absolute -left-48 top-1/3 h-[520px] w-[520px] rounded-full opacity-15 dark:opacity-10"
            style={{
              background:
                "radial-gradient(circle at center, rgba(99,102,241,0.35) 0%, transparent 60%)",
              filter: "blur(100px)",
            }}
          />
          {/* Soft cyan blob — bottom right */}
          <div
            className="absolute -bottom-48 right-1/4 h-[460px] w-[460px] rounded-full opacity-15 dark:opacity-10"
            style={{
              background:
                "radial-gradient(circle at center, rgba(34,211,238,0.28) 0%, transparent 60%)",
              filter: "blur(100px)",
            }}
          />
          {/* Soft center glow for hero focus */}
          <div
            className="absolute left-1/2 top-[-220px] h-[520px] w-[860px] -translate-x-1/2 opacity-20 dark:opacity-15"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(56,189,248,0.30) 0%, transparent 62%)",
              filter: "blur(70px)",
            }}
          />
        </>
      )}
    </div>
  );
}