import { Network } from "lucide-react";
import type { TaskItem } from "@/lib/projects";

function taskDependencies(taskText: string, selfId?: string): string[] {
  const ids = new Set<string>();
  const regex = /\b(?:T(?:A-)?\d{2,4})\b/gi;
  const normSelf = selfId ? selfId.trim().toUpperCase() : null;
  for (const m of taskText.matchAll(regex)) {
    const norm = m[0].toUpperCase().replace("TA-", "T");
    if (normSelf && norm === normSelf) continue;
    ids.add(norm);
  }
  return [...ids];
}

export function TaskDAG({ tasks }: { tasks: TaskItem[] }) {
  if (tasks.length === 0) return null;

  // Build adjacency: taskId → [dependsOn]
  const edges: { from: string; to: string }[] = [];
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  for (const t of tasks) {
    const deps = taskDependencies(t.text, t.id);
    for (const dep of deps) {
      if (taskMap.has(dep)) {
        edges.push({ from: dep, to: t.id });
      }
    }
  }

  if (edges.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        <Network className="h-4 w-4 shrink-0" />
        <span>Tidak ada dependensi antar task — semua task bisa dikerjakan secara paralel atau urutan bebas.</span>
      </div>
    );
  }

  // Simple layered layout: group tasks by depth (longest path from root)
  const depth = new Map<string, number>();
  function getDepth(id: string, visited = new Set<string>()): number {
    if (depth.has(id)) return depth.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);
    const incoming = edges.filter((e) => e.to === id);
    if (incoming.length === 0) { depth.set(id, 0); return 0; }
    const maxDep = Math.max(...incoming.map((e) => getDepth(e.from, visited)));
    const d = maxDep + 1;
    depth.set(id, d);
    return d;
  }
  for (const t of tasks) getDepth(t.id);

  // Group by depth layer
  const layers = new Map<number, TaskItem[]>();
  for (const t of tasks) {
    const d = depth.get(t.id) || 0;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(t);
  }
  const maxLayer = Math.max(0, ...[...layers.keys()]);

  const NODE_W = 120;
  const NODE_H = 28;
  const GAP_X = 40;
  const GAP_Y = 16;
  const totalWidth = (maxLayer + 1) * NODE_W + maxLayer * GAP_X + 40;
  const maxPerLayer = Math.max(1, ...[...layers.values()].map((l) => l.length));
  const totalHeight = maxPerLayer * NODE_H + (maxPerLayer - 1) * GAP_Y + 40;

  // Position map
  const positions = new Map<string, { x: number; y: number }>();
  for (let layer = 0; layer <= maxLayer; layer++) {
    const nodes = layers.get(layer) || [];
    for (let i = 0; i < nodes.length; i++) {
      const x = 20 + layer * (NODE_W + GAP_X);
      const y = 20 + i * (NODE_H + GAP_Y);
      positions.set(nodes[i].id, { x, y });
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-background p-2">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="text-xs"
      >
        {/* Draw edges */}
        {edges.map((e, i) => {
          const from = positions.get(e.from);
          const to = positions.get(e.to);
          if (!from || !to) return null;
          const x1 = from.x + NODE_W / 2;
          const y1 = from.y + NODE_H / 2;
          const x2 = to.x + NODE_W / 2;
          const y2 = to.y + NODE_H / 2;
          const mx = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1.5"
              strokeOpacity="0.4"
              markerEnd="url(#arrow)"
            />
          );
        })}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6 Z" fill="hsl(var(--muted-foreground))" fillOpacity="0.5" />
          </marker>
        </defs>
        {/* Draw nodes */}
        {tasks.map((t) => {
          const pos = positions.get(t.id);
          if (!pos) return null;
          const fillColor = t.done ? "hsl(142 71% 95%)" : "hsl(var(--card))";
          const strokeColor = t.done ? "hsl(142 71% 45%)" : "hsl(var(--border))";
          const textColor = t.done ? "hsl(142 40% 30%)" : "hsl(var(--foreground))";
          return (
            <g key={t.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
                rx="6"
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth="1.5"
              />
              <text
                x={pos.x + NODE_W / 2}
                y={pos.y + NODE_H / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={textColor}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="600"
              >
                {t.id} {t.done ? "✓" : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
