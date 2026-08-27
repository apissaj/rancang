"use client";

import { useState } from "react";
import type { StructureResponse } from "@/lib/clarify-types";

/**
 * FeatureMap — renders a 3-level mind-map (planning -> fitur -> sub-fitur)
 * as node cards connected by curved SVG lines. Pure CSS/SVG, dark theme.
 * No canvas, no emoji. Layout mirrors ngodingpakeai's structure view.
 */
export default function FeatureMap({ data }: { data: StructureResponse }) {
  const [zoom, setZoom] = useState(1);
  const minZoom = 0.6;
  const maxZoom = 1.6;

  const fiturCount = data.fitur.length;
  // Estimated canvas height so the SVG connector layer lines up with rows.
  const rowH = 92;
  const rowGap = 20;
  const canvasH = 40 + fiturCount * rowH + (fiturCount - 1) * rowGap + 40;

  return (
    <div className="relative rounded-xl border bg-card/30 p-4">
      {/* Zoom controls (bottom-left) */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-lg border bg-background/80 backdrop-blur">
        <button
          className="px-2.5 py-1.5 text-sm hover:bg-muted"
          onClick={() => setZoom((z) => Math.min(maxZoom, +(z + 0.2).toFixed(2)))}
          aria-label="Perbesar"
        >
          +
        </button>
        <button
          className="border-t px-2.5 py-1.5 text-sm hover:bg-muted"
          onClick={() => setZoom((z) => Math.max(minZoom, +(z - 0.2).toFixed(2)))}
          aria-label="Perkecil"
        >
          −
        </button>
        <button
          className="border-t px-2.5 py-1.5 text-xs hover:bg-muted"
          onClick={() => setZoom(1)}
          aria-label="Reset tampilan"
        >
          ⟳
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="relative min-w-[820px] origin-top transition-transform"
          style={{ transform: `scale(${zoom})` }}
        >
          <div className="grid grid-cols-[220px_1fr_1fr] gap-x-10">
            {/* Column 1: planning root */}
            <div className="flex items-start pt-10">
              <div className="w-full rounded-xl border border-dashed border-foreground/30 bg-card px-4 py-4">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Perencanaan
                </div>
                <div className="mt-1 text-base font-semibold leading-snug">
                  {data.planning}
                </div>
                {data.planningNote && (
                  <div className="mt-1 text-xs text-muted-foreground">{data.planningNote}</div>
                )}
              </div>
            </div>

            {/* Column 2: features */}
            <div className="flex flex-col" style={{ gap: rowGap }}>
              {data.fitur.map((f, i) => (
                <FeatureNode key={i} name={f.name} index={i} />
              ))}
            </div>

            {/* Column 3: sub-features */}
            <div className="flex flex-col" style={{ gap: rowGap }}>
              {data.fitur.map((f, i) => (
                <SubFeatureNode key={i} items={f.subFitur} />
              ))}
            </div>
          </div>

          <ConnectorSvg fiturCount={fiturCount} rowH={rowH} rowGap={rowGap} />
        </div>
      </div>
    </div>
  );
}

function FeatureNode({ name, index }: { name: string; index: number }) {
  return (
    <div
      className="rounded-xl border border-dashed border-foreground/30 bg-card px-4 py-3"
      style={{ minHeight: 80 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-foreground/20 bg-background text-xs font-semibold text-muted-foreground">
            {index + 1}
          </span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Fitur
          </span>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
          DONE
        </span>
      </div>
      <div className="mt-2 text-sm font-medium leading-snug">{name}</div>
    </div>
  );
}

function SubFeatureNode({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const preview = items.slice(0, 2);
  return (
    <div
      className="rounded-xl border border-dashed border-foreground/20 bg-card/60 px-4 py-3"
      style={{ minHeight: 80 }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sub Fitur
      </div>
      <ul className="mt-2 space-y-1.5">
        {(open ? items : preview).map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
      {items.length > 2 && (
        <button
          className="mt-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Sembunyikan" : `Lihat semua (${items.length})`}
        </button>
      )}
    </div>
  );
}

function ConnectorSvg({
  fiturCount,
  rowH,
  rowGap,
}: {
  fiturCount: number;
  rowH: number;
  rowGap: number;
}) {
  const col1 = 220;
  const col2 = 220 + (1 / 3) * 820 + 10;
  const col3 = 220 + (2 / 3) * 820 + 10;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {Array.from({ length: fiturCount }).map((_, i) => {
        const y = 40 + i * (rowH + rowGap) + rowH / 2;
        return (
          <g key={i} stroke="currentColor" strokeWidth="1" fill="none" opacity="0.2">
            <path d={`M ${col1} ${y} C ${col1 + 60} ${y}, ${col2 - 60} ${y}, ${col2} ${y}`} />
            <path d={`M ${col2 + 220} ${y} C ${col2 + 280} ${y}, ${col3 - 60} ${y}, ${col3} ${y}`} />
          </g>
        );
      })}
    </svg>
  );
}
