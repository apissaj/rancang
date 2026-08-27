"use client";

import type { StructureResponse } from "@/lib/clarify-types";

/**
 * FeatureMap — renders a 3-level mind-map (planning -> fitur -> sub-fitur)
 * as node cards connected by curved SVG lines. Pure CSS/SVG, dark theme.
 * No canvas, no emoji.
 */
export default function FeatureMap({ data }: { data: StructureResponse }) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[760px] py-6">
        <div className="grid grid-cols-[200px_1fr_1fr] gap-x-6">
          {/* Column 1: planning root */}
          <div className="flex items-start pt-10">
            <div className="w-full rounded-lg border border-dashed border-foreground/30 bg-card/60 px-4 py-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Perencanaan
              </div>
              <div className="mt-1 text-sm font-semibold">{data.planning}</div>
            </div>
          </div>

          {/* Column 2: features */}
          <div className="flex flex-col gap-4">
            {data.fitur.map((f, i) => (
              <FeatureNode key={i} name={f.name} index={i} total={data.fitur.length} />
            ))}
          </div>

          {/* Column 3: sub-features */}
          <div className="flex flex-col gap-4">
            {data.fitur.map((f, i) => (
              <SubFeatureNode key={i} items={f.subFitur} />
            ))}
          </div>
        </div>

        <ConnectorSvg fiturCount={data.fitur.length} />
      </div>
    </div>
  );
}

function FeatureNode({ name, index, total }: { name: string; index: number; total: number }) {
  const top = 40 + (index * (160 + 16));
  return (
    <div
      className="rounded-lg border border-dashed border-foreground/30 bg-card/60 px-4 py-3"
      style={{ minHeight: 64 }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Fitur
      </div>
      <div className="mt-1 text-sm font-medium">{name}</div>
    </div>
  );
}

function SubFeatureNode({ items }: { items: string[] }) {
  return (
    <div
      className="rounded-lg border border-dashed border-foreground/20 bg-card/40 px-4 py-3"
      style={{ minHeight: 64 }}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sub Fitur
      </div>
      <ul className="mt-1 space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Decorative connector layer. The actual curved lines between columns are
 * approximated with a single SVG overlay using simple bezier paths. This is a
 * lightweight visual aid — node positions above drive the layout.
 */
function ConnectorSvg({ fiturCount }: { fiturCount: number }) {
  const rows = Array.from({ length: fiturCount });
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {rows.map((_, i) => {
        const y = 40 + i * 176 + 32;
        return (
          <g key={i} stroke="currentColor" strokeWidth="1" fill="none" opacity="0.25">
            <path d={`M 200 ${y} C 260 ${y}, 280 ${y}, 340 ${y}`} />
            <path d={`M 540 ${y} C 600 ${y}, 620 ${y}, 680 ${y}`} />
          </g>
        );
      })}
    </svg>
  );
}
