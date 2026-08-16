"use client";

/**
 * LandingBackground — pure CSS background layer for the landing page.
 *
 * Pattern sourced from GitHub references (no canvas, no JS animation):
 * - Cruip `tailwind-landing-page-template` (page-illustration.tsx): large
 *   blurred gradient blobs (`bg-linear-to-tr from-blue-500 opacity-50
 *   blur-[160px]`) absolutely positioned behind the hero content.
 * - AstroWind Hero: `absolute inset-0 pointer-events-none` wrapper behind content.
 *
 * Layers (dark theme friendly, subtle blue/cyan tint — no grid, no lines):
 *  1. Large soft blob top-right (blue hint).
 *  2. Soft blob center-left (indigo/blue hint, very low opacity).
 *  3. Soft blob bottom (cyan hint).
 *  4. Base keeps `bg-background` so the page stays consistent with the theme.
 */
export default function LandingBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
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
    </div>
  );
}