"use client";

import { AlignJustify, Image as ImageIcon } from "lucide-react";
import { extractFrontMatter, resolveTokens } from "@/lib/design-yaml";
import type { Screen, ScreenComponent } from "@/lib/storage";

type Tokens = {
  colors?: { primary?: string; secondary?: string; tertiary?: string; neutral?: string };
  rounded?: { sm?: string; md?: string; lg?: string };
  spacing?: { sm?: string; md?: string; lg?: string };
};

/** Relative luminance (WCAG). */
function relativeLuminance(hex: string): number {
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks black or white text against a hex bg by actual WCAG contrast ratio, not a flat luminance cutoff
 *  (a flat >0.5 threshold picks white for mid-tone colors like amber #F59E0B where white only hits ~2.1:1
 *  contrast — badly fails AA's 4.5:1 — while black hits ~9.8:1; comparing real ratios avoids that). */
function contrastText(hex: string): string {
  const bgLum = relativeLuminance(hex);
  const whiteRatio = contrastRatio(bgLum, 1);
  const blackRatio = contrastRatio(bgLum, 0);
  return whiteRatio >= blackRatio ? "#ffffff" : "#000000";
}

/** Mutes a hex color toward its contrast-text color (for secondary/muted body copy). */
function muted(hex: string): string {
  const base = contrastText(hex) === "#000000" ? "#000000" : "#ffffff";
  return `color-mix(in srgb, ${base} 60%, ${hex})`;
}

function ComponentBlock({ c, tokens, onNavigate }: { c: ScreenComponent; tokens: Tokens; onNavigate: (id: string) => void }) {
  const primary = tokens.colors?.primary ?? "#1A1C1E";
  const tertiary = tokens.colors?.tertiary ?? "#B8422E";
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const roundedSm = tokens.rounded?.sm ?? "4px";
  const spacingSm = tokens.spacing?.sm ?? "8px";

  // Body/content text is ALWAYS computed for contrast against the neutral surface it sits on —
  // accent tokens (primary/secondary/tertiary) are reserved for buttons/borders/highlights only,
  // never for large blocks of readable text (that's what broke contrast before).
  const onSurface = contrastText(neutral);
  const onSurfaceMuted = muted(neutral);

  const clickable = !!c.onClick;
  const handleClick = clickable ? () => onNavigate(c.onClick!) : undefined;

  switch (c.type) {
    case "header":
      return (
        <div style={{ color: onSurface, fontWeight: 700, fontSize: "1.5rem", padding: `${spacingSm} 0` }}>
          {c.label}
        </div>
      );
    case "text":
      return <p style={{ color: onSurfaceMuted, fontSize: "0.9rem" }}>{c.label}</p>;
    case "button":
      return (
        <button
          onClick={handleClick}
          style={{ backgroundColor: tertiary, color: contrastText(tertiary), borderRadius: roundedSm, padding: `${spacingSm} 16px`, fontWeight: 600, border: "none", cursor: clickable ? "pointer" : "default", width: "100%" }}
        >
          {c.label}
        </button>
      );
    case "input":
      return (
        <div style={{ border: `1px solid ${onSurfaceMuted}`, borderRadius: roundedSm, padding: spacingSm, color: onSurfaceMuted, fontSize: "0.85rem" }}>
          {c.label}
        </div>
      );
    case "list-item":
      return (
        <button
          onClick={handleClick}
          style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${onSurfaceMuted}33`, padding: `${spacingSm} 0`, width: "100%", background: "none", border: "none", textAlign: "left", cursor: clickable ? "pointer" : "default", color: onSurface }}
        >
          <AlignJustify className="h-3.5 w-3.5 shrink-0" style={{ color: onSurfaceMuted }} />
          {c.label}
        </button>
      );
    case "card":
      return (
        <div onClick={handleClick} style={{ border: `1px solid ${onSurfaceMuted}33`, borderRadius: roundedSm, padding: spacingSm, cursor: clickable ? "pointer" : "default", color: onSurface }}>
          {c.label}
        </div>
      );
    case "nav-item":
      return (
        <button
          onClick={handleClick}
          style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.75rem", background: primary, color: contrastText(primary), border: "none", cursor: clickable ? "pointer" : "default" }}
        >
          {c.label}
        </button>
      );
    case "image-placeholder":
      return (
        <div style={{ background: `${onSurfaceMuted}22`, borderRadius: roundedSm, height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: onSurfaceMuted }}>
          <ImageIcon className="h-5 w-5" />
        </div>
      );
    case "divider":
      return <hr style={{ borderColor: `${onSurfaceMuted}33` }} />;
    default:
      return <div style={{ color: onSurfaceMuted, fontSize: "0.8rem" }}>{c.label}</div>;
  }
}

function resolveDesignTokens(designMd: string): Tokens {
  const front = extractFrontMatter(designMd);
  if (!front) return {};
  return resolveTokens(front) as unknown as Tokens;
}

export function WireframeCanvas({
  screen,
  designMd,
  pwa,
  onNavigate,
}: {
  screen: Screen;
  designMd: string;
  pwa: boolean;
  onNavigate: (id: string) => void;
}) {
  const tokens = resolveDesignTokens(designMd);
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const isMobile = screen.platform === "mobile";

  return (
    <div
      className="mx-auto flex flex-col overflow-hidden rounded-2xl border shadow-md"
      style={{
        width: isMobile ? 375 : "100%",
        maxWidth: isMobile ? 375 : 640,
        background: neutral,
      }}
    >
      {isMobile && pwa && (
        <div className="flex items-center gap-1 border-b bg-black/5 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
          <span className="text-[10px] opacity-60">Installed app</span>
        </div>
      )}
      <div className="flex flex-col gap-3 overflow-auto p-4" style={{ minHeight: isMobile ? 560 : 400 }}>
        {screen.components.map((c, i) => (
          <ComponentBlock key={i} c={c} tokens={tokens} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

/** Same device-frame wrapper as WireframeCanvas, but renders a generated hi-fi image instead of
 *  schematic component blocks. Static — no click-navigation inside the image itself. */
export function MockupCanvas({ screen, designMd, image }: { screen: Screen; designMd: string; image: string }) {
  const tokens = resolveDesignTokens(designMd);
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const isMobile = screen.platform === "mobile";

  return (
    <div
      className="mx-auto flex flex-col overflow-hidden rounded-2xl border shadow-md"
      style={{ width: isMobile ? 375 : "100%", maxWidth: isMobile ? 375 : 640, background: neutral }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URL, next/image can't optimize it */}
      <img src={image} alt={screen.name} className="w-full object-cover" style={{ minHeight: isMobile ? 560 : 400 }} />
    </div>
  );
}
