"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FolderGit2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Palette,
  FileText,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  Bot,
  FileCode2,
  Cpu,
  Loader2,
  Circle,
  Sparkles,
  Network,
  Eye,
  Search,
  History,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScaffoldDialog } from "@/components/scaffold-dialog";

/* ── Types ─────────────────────────────────────────────── */

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  phase: string;
}

interface TaskSummary {
  total: number;
  done: number;
  pending: number;
}

interface BlueprintItem {
  id: string;
  title: string;
  idea: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  source: string;
  docs: string[];
  tasks: TaskSummary;
}

interface BlueprintDetail {
  blueprintId: string;
  title: string;
  summary: TaskSummary;
  tasks: TaskItem[];
  next: TaskItem | null;
}

interface TaskPromptResult {
  ok: boolean;
  blueprintId: string;
  taskId: string;
  prompt: string;
}

interface SearchResultItem {
  blueprintId: string;
  blueprintTitle: string;
  id: string;
  text: string;
  done: boolean;
  phase: string;
}

interface ExecutionLogItem {
  taskId: string;
  action: "complete" | "reopen";
  timestamp: number;
}

interface VersionItem {
  id: string;
  note: string;
  timestamp: number;
  summary: { total: number; done: number; pending: number } | null;
}

type ExecTab = "opencode" | "claude-code" | "hermes" | "direct";

const EXEC_TABS: { id: ExecTab; label: string; icon: typeof Terminal }[] = [
  { id: "opencode", label: "OpenCode", icon: Bot },
  { id: "claude-code", label: "Claude Code", icon: FileCode2 },
  { id: "hermes", label: "Hermes", icon: Cpu },
  { id: "direct", label: "Terminal", icon: Terminal },
];

function buildExecCommand(tab: ExecTab, id: string, title: string): string {
  switch (tab) {
    case "opencode":
      return `opencode prompt "Jalankan rancang_execution_prompt(blueprint_id=\\"${id}\\"). Ambil task pertama dengan rancang_next_task, implementasi + verifikasi, lalu rancang_task_complete. Ulangi sampai semua task selesai."`;
    case "claude-code":
      return `claude --prompt "Eksekusi blueprint ${id} (${title}). Gunakan MCP rancang_next_task → implement → rancang_task_complete. Semua task harus selesai."`;
    case "hermes":
      return `hermes mcp tool rancang rancang_execution_prompt blueprint_id="${id}"`;
    case "direct":
    default:
      return `cd <folder-proyek> && cat AGENTS.md`;
  }
}

/* ── Dependency detection (client-side mirror of store.mjs) ── */

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

/* ── DAG Graph Component ──────────────────────────────────── */

function TaskDAG({ tasks }: { tasks: TaskItem[] }) {
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

/* ── Main Component ─────────────────────────────────────── */

export default function ProjectsPage() {
  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded detail state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BlueprintDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"list" | "dag">("list");

  // Per-task toggle state
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  // Command copy state
  const [cmdCopied, setCmdCopied] = useState<string | null>(null);
  const [execTab, setExecTab] = useState<ExecTab>("opencode");

  // Task prompt state
  const [promptTaskId, setPromptTaskId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);

  // Search state (multi-blueprint task search)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // History + versions state
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<ExecutionLogItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versionsData, setVersionsData] = useState<VersionItem[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mcp/blueprint");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal memuat daftar blueprint");
        return;
      }
      setBlueprints(data.blueprints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat blueprint dari server");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadDetail(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetailTab("list");
    try {
      const res = await fetch(`/api/mcp/task?blueprintId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok) {
        setDetail(data);
      }
    } catch (err) {
      console.error("[projects] failed to load task detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function toggleTask(blueprintId: string, taskId: string, currentDone: boolean) {
    setTogglingTask(taskId);
    try {
      const res = await fetch("/api/mcp/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId, taskId, done: !currentDone }),
      });
      const data = await res.json();
      if (res.ok && data.tasks) {
        setDetail((prev) =>
          prev ? { ...prev, tasks: data.tasks, summary: data.summary, next: data.next } : prev
        );
        setBlueprints((prev) =>
          prev.map((b) => (b.id === blueprintId ? { ...b, tasks: data.summary } : b))
        );
      }
    } catch (err) {
      console.error("[projects] toggle task failed:", err);
    } finally {
      setTogglingTask(null);
    }
  }

  async function fetchTaskPrompt(blueprintId: string, taskId: string) {
    if (promptTaskId === taskId) {
      setPromptTaskId(null);
      setPromptText(null);
      return;
    }
    setPromptTaskId(taskId);
    setPromptLoading(true);
    setPromptText(null);
    try {
      const res = await fetch(`/api/mcp/task/prompt?blueprintId=${encodeURIComponent(blueprintId)}&taskId=${encodeURIComponent(taskId)}`);
      const data: TaskPromptResult = await res.json();
      if (data.ok) {
        setPromptText(data.prompt);
      }
    } catch (err) {
      console.error("[projects] fetch task prompt failed:", err);
    } finally {
      setPromptLoading(false);
    }
  }

  const copyExecCmd = useCallback(
    (id: string, title: string) => {
      const cmd = buildExecCommand(execTab, id, title);
      navigator.clipboard.writeText(cmd);
      setCmdCopied(id);
      setTimeout(() => setCmdCopied(null), 2000);
    },
    [execTab]
  );

  async function runSearch() {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/mcp/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search gagal");
      setSearchResults(data.results || []);
      if ((data.results || []).length === 0) {
        setSearchResults([]);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search gagal");
    } finally {
      setSearchLoading(false);
    }
  }

  async function toggleHistory(blueprintId: string) {
    if (historyFor === blueprintId) {
      setHistoryFor(null);
      setHistoryData(null);
      return;
    }
    setHistoryFor(blueprintId);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const res = await fetch(`/api/mcp/history?blueprint_id=${encodeURIComponent(blueprintId)}`);
      const data = await res.json();
      if (res.ok) setHistoryData(data.logs || []);
    } catch (err) {
      console.error("[projects] history failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function toggleVersions(blueprintId: string) {
    if (versionsFor === blueprintId) {
      setVersionsFor(null);
      setVersionsData(null);
      return;
    }
    setVersionsFor(blueprintId);
    setVersionsLoading(true);
    setVersionsData(null);
    try {
      const res = await fetch(`/api/mcp/versions?blueprint_id=${encodeURIComponent(blueprintId)}`);
      const data = await res.json();
      if (res.ok) setVersionsData(data.versions || []);
    } catch (err) {
      console.error("[projects] versions failed:", err);
    } finally {
      setVersionsLoading(false);
    }
  }

  const totalTasks = blueprints.reduce((acc, b) => acc + (b.tasks?.total || 0), 0);
  const totalDone = blueprints.reduce((acc, b) => acc + (b.tasks?.done || 0), 0);
  const overallPercent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Proyek & Task Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau progres pengerjaan task oleh AI Coding Agent. Centang task langsung dari sini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/plan" />}>
            <FileText className="h-3.5 w-3.5" />
            Buat Blueprint Baru
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Blueprint</CardDescription>
            <CardTitle className="text-2xl font-bold">{blueprints.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Tersimpan di disk lokal (~/.rancang/blueprints)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Progres Keseluruhan</CardDescription>
            <CardTitle className="text-2xl font-bold">{overallPercent}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${overallPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalDone} dari {totalTasks} task selesai
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Status MCP Bridge</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-5 w-5" />
              Aktif (:3110)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">8 tools siap dipanggil oleh Coding Agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Command tab selector — global */}
      <div className="mt-8 flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Perintah Eksekusi:</span>
        <div className="flex gap-1 rounded-lg border bg-muted/30 p-0.5">
          {EXEC_TABS.map((t) => {
            const Icon = t.icon;
            const active = execTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setExecTab(t.id)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blueprint Cards List */}
      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-foreground">Daftar Blueprint</h2>
          <div className="flex w-full gap-2 sm:w-auto">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Cari task lintas blueprint..."
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 sm:w-64"
            />
            <Button variant="outline" size="sm" onClick={runSearch} disabled={searchLoading}>
              {searchLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Cari
            </Button>
          </div>
        </div>

        {searchError && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {searchError}
          </div>
        )}

        {searchResults !== null && !searchLoading && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">
                Hasil pencarian: {searchResults.length} task
              </p>
              <button
                onClick={() => setSearchResults(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Tutup
              </button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground">Tidak ada task yang cocok.</p>
            ) : (
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                {searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                  >
                    <span
                      className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${
                        r.done ? "bg-green-500" : "bg-muted-foreground/40"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">
                        <span className="font-mono text-muted-foreground">{r.id}</span>{" "}
                        {r.text}
                      </p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground/70">
                        {r.blueprintId} · {r.phase}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && blueprints.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Memuat daftar blueprint dari disk...
          </div>
        )}

        {!loading && blueprints.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
            <FolderGit2 className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-4 text-base font-semibold">Belum ada blueprint</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Buat dokumen PRD dan arsitektur terlebih dahulu di tab Rencana.
            </p>
            <Button className="mt-4" nativeButton={false} render={<Link href="/plan" />}>
              Mulai Buat PRD
            </Button>
          </div>
        )}

        {blueprints.map((b) => {
          const tasksTotal = b.tasks?.total || 0;
          const tasksDone = b.tasks?.done || 0;
          const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
          const hasDesign = b.docs?.includes("design");
          const isExpanded = expandedId === b.id;
          const d = isExpanded ? detail : null;

          return (
            <Card key={b.id} className="transition-all hover:border-foreground/20">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {b.id}
                      </Badge>
                      {hasDesign && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Palette className="h-3 w-3" /> Desain
                        </Badge>
                      )}
                      {tasksTotal > 0 && tasksDone === tasksTotal && (
                        <Badge className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle2 className="h-3 w-3" /> Selesai
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(b.updatedAt || b.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{b.title || "Untitled Blueprint"}</CardTitle>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => loadDetail(b.id)}
                      title="Lihat & centang task"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      Tasks
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyExecCmd(b.id, b.title)}
                      title="Salin Perintah Eksekusi"
                    >
                      {cmdCopied === b.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {cmdCopied === b.id ? "Tersalin" : "Salin Cmd"}
                    </Button>

                    <ScaffoldDialog blueprintId={b.id} blueprintTitle={b.title} />

                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/plan?mcpId=${b.id}`} />}>
                      <FileText className="h-3.5 w-3.5" />
                      PRD
                    </Button>

                    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/design?planId=${b.id}`} />}>
                      <Palette className="h-3.5 w-3.5" />
                      Desain
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHistory(b.id)}
                      title="Lihat riwayat eksekusi task"
                    >
                      <History className="h-3.5 w-3.5" />
                      Riwayat
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleVersions(b.id)}
                      title="Lihat versi blueprint"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Versi
                    </Button>
                  </div>
                </div>
                {b.idea && (
                  <CardDescription className="line-clamp-2 text-xs leading-relaxed">
                    {b.idea}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="pt-0">
                {/* Progress Bar */}
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">Progres Task</span>
                    <span className="font-mono text-muted-foreground">
                      {tasksDone} / {tasksTotal} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {b.tasks?.pending || 0} pending
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                      {tasksDone} selesai
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/80">
                      {b.docs?.join(", ")}
                    </span>
                  </div>
                </div>

                {/* Expanded Task Detail */}
                {isExpanded && (
                  <div className="mt-3 rounded-lg border p-3">
                    {detailLoading && (
                      <div className="flex items-center gap-2 py-4 text-center text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat task detail...
                      </div>
                    )}

                    {!detailLoading && d && (
                      <>
                        {/* Next task highlight */}
                        {d.next && (
                          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800 dark:bg-blue-950">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                              Task Berikutnya
                            </p>
                            <p className="mt-0.5 font-mono text-xs font-medium text-blue-800 dark:text-blue-300">
                              [{d.next.id}] {d.next.text}
                            </p>
                          </div>
                        )}

                        {/* Tabs: List / DAG */}
                        <div className="mb-3 flex gap-1 rounded-md border bg-muted/30 p-0.5">
                          <button
                            onClick={() => setDetailTab("list")}
                            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                              detailTab === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                          >
                            Daftar Task
                          </button>
                          <button
                            onClick={() => setDetailTab("dag")}
                            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                              detailTab === "dag" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                            }`}
                          >
                            <Network className="mr-1 inline h-3 w-3" />
                            Dependency Graph
                          </button>
                        </div>

                        {detailTab === "list" ? (
                          <>
                            {/* Task list */}
                            <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
                              {d.tasks.map((task) => (
                                <div key={task.id} className="group flex items-start gap-0.5">
                                  <button
                                    onClick={() => toggleTask(d.blueprintId, task.id, task.done)}
                                    disabled={togglingTask === task.id}
                                    className={`flex flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/50 ${
                                      task.done ? "text-muted-foreground line-through" : "text-foreground"
                                    }`}
                                  >
                                    {togglingTask === task.id ? (
                                      <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                                    ) : task.done ? (
                                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-primary" />
                                    )}
                                    <span className="shrink-0 font-mono font-medium text-muted-foreground">{task.id}</span>
                                    <span className="flex-1 leading-relaxed">{task.text}</span>
                                  </button>
                                  {/* Prompt button */}
                                  {!task.done && (
                                    <button
                                      onClick={() => fetchTaskPrompt(d.blueprintId, task.id)}
                                      className={`mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
                                        promptTaskId === task.id ? "bg-muted text-foreground" : ""
                                      }`}
                                      title="Lihat prompt task ini"
                                    >
                                      {promptTaskId === task.id && promptLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Sparkles className="h-3 w-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Task prompt viewer */}
                            {promptTaskId && promptText && (
                              <div className="mt-3 rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/50">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    <Eye className="h-3 w-3" />
                                    Prompt: {promptTaskId}
                                  </p>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(promptText);
                                      setPromptCopied(true);
                                      setTimeout(() => setPromptCopied(false), 2000);
                                    }}
                                    className="flex items-center gap-1 rounded bg-white/80 px-2 py-0.5 text-[10px] font-medium text-blue-700 transition-colors hover:bg-white dark:bg-blue-900/80 dark:text-blue-300"
                                  >
                                    {promptCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                    {promptCopied ? "Tersalin" : "Salin"}
                                  </button>
                                </div>
                                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground">
                                  {promptText}
                                </pre>
                              </div>
                            )}
                          </>
                        ) : (
                          /* DAG View */
                          <TaskDAG tasks={d.tasks} />
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* History panel */}
                {historyFor === b.id && (
                  <div className="mt-3 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-foreground">
                        Riwayat Eksekusi
                      </p>
                      <button
                        onClick={() => toggleHistory(b.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Tutup
                      </button>
                    </div>
                    {historyLoading ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat riwayat...
                      </div>
                    ) : historyData === null || historyData.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">
                        Belum ada riwayat eksekusi. Task yang dicentang/dicentang ulang akan muncul di sini.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {historyData.map((log, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                          >
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium ${
                                log.action === "complete"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                              }`}
                            >
                              {log.action === "complete" ? "✓ selesai" : "↺ dibuka"}
                            </span>
                            <span className="shrink-0 font-mono text-muted-foreground">
                              {log.taskId}
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70">
                              {new Date(log.timestamp).toLocaleString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Versions panel */}
                {versionsFor === b.id && (
                  <div className="mt-3 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-foreground">
                        Versi Blueprint
                      </p>
                      <button
                        onClick={() => toggleVersions(b.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Tutup
                      </button>
                    </div>
                    {versionsLoading ? (
                      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat versi...
                      </div>
                    ) : versionsData === null || versionsData.length === 0 ? (
                      <p className="py-2 text-xs text-muted-foreground">
                        Belum ada snapshot versi. Snapshot dibuat otomatis sebelum scaffolding dipicu.
                      </p>
                    ) : (
                      <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                        {versionsData.map((v, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                          >
                            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
                            <span className="shrink-0 font-mono font-medium">{v.id}</span>
                            <span className="truncate text-muted-foreground">
                              {v.note || "(tanpa catatan)"}
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/70">
                              {new Date(v.timestamp).toLocaleString("id-ID", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}