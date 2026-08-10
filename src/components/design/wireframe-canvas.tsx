"use client";

import { AlignJustify, Image as ImageIcon } from "lucide-react";
import { extractFrontMatter, resolveTokens } from "@/lib/design-yaml";
import type { Screen, ScreenComponent } from "@/lib/storage";

type Tokens = {
  colors?: { primary?: string; secondary?: string; tertiary?: string; neutral?: string };
  rounded?: { sm?: string; md?: string; lg?: string };
  spacing?: { sm?: string; md?: string; lg?: string };
};

function ComponentBlock({ c, tokens, onNavigate }: { c: ScreenComponent; tokens: Tokens; onNavigate: (id: string) => void }) {
  const primary = tokens.colors?.primary ?? "#1A1C1E";
  const secondary = tokens.colors?.secondary ?? "#6C7278";
  const tertiary = tokens.colors?.tertiary ?? "#B8422E";
  const neutral = tokens.colors?.neutral ?? "#F7F5F2";
  const roundedSm = tokens.rounded?.sm ?? "4px";
  const spacingSm = tokens.spacing?.sm ?? "8px";

  const clickable = !!c.onClick;
  const handleClick = clickable ? () => onNavigate(c.onClick!) : undefined;

  switch (c.type) {
    case "header":
      return (
        <div style={{ color: primary, fontWeight: 700, fontSize: "1.5rem", padding: `${spacingSm} 0` }}>
          {c.label}
        </div>
      );
    case "text":
      return <p style={{ color: secondary, fontSize: "0.9rem" }}>{c.label}</p>;
    case "button":
      return (
        <button
          onClick={handleClick}
          style={{ backgroundColor: tertiary, color: "#fff", borderRadius: roundedSm, padding: `${spacingSm} 16px`, fontWeight: 600, border: "none", cursor: clickable ? "pointer" : "default", width: "100%" }}
        >
          {c.label}
        </button>
      );
    case "input":
      return (
        <div style={{ border: `1px solid ${secondary}`, borderRadius: roundedSm, padding: spacingSm, color: secondary, fontSize: "0.85rem" }}>
          {c.label}
        </div>
      );
    case "list-item":
      return (
        <button
          onClick={handleClick}
          style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${neutral}`, padding: `${spacingSm} 0`, width: "100%", background: "none", border: "none", textAlign: "left", cursor: clickable ? "pointer" : "default", color: primary }}
        >
          <AlignJustify className="h-3.5 w-3.5 shrink-0" style={{ color: secondary }} />
          {c.label}
        </button>
      );
    case "card":
      return (
        <div onClick={handleClick} style={{ border: `1px solid ${secondary}33`, borderRadius: roundedSm, padding: spacingSm, cursor: clickable ? "pointer" : "default", color: primary }}>
          {c.label}
        </div>
      );
    case "nav-item":
      return (
        <button
          onClick={handleClick}
          style={{ borderRadius: "999px", padding: "4px 10px", fontSize: "0.75rem", background: neutral, color: primary, border: "none", cursor: clickable ? "pointer" : "default" }}
        >
          {c.label}
        </button>
      );
    case "image-placeholder":
      return (
        <div style={{ background: neutral, borderRadius: roundedSm, height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: secondary }}>
          <ImageIcon className="h-5 w-5" />
        </div>
      );
    case "divider":
      return <hr style={{ borderColor: neutral }} />;
    default:
      return <div style={{ color: secondary, fontSize: "0.8rem" }}>{c.label}</div>;
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
