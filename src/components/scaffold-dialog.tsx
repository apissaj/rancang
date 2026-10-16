"use client";

import { useState, useEffect } from "react";
import { FolderOpen, Loader2, Check, Copy, AlertCircle, Terminal, Bot, Cpu, FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ScaffoldResult {
  success: boolean;
  targetDir: string;
  filesWritten: string[];
  blueprintId: string;
  title: string;
  totalTasks: number;
}

interface Props {
  blueprintId: string | null;
  blueprintTitle: string;
  disabled?: boolean;
}

type CommandTab = "opencode" | "claude-code" | "hermes" | "direct";

type AgentFormat = "agents" | "claude" | "codex" | "cursor" | "cline" | "windsurf" | "copilot" | "opencode" | "all";

const COMMAND_TABS: { id: CommandTab; label: string; icon: typeof Terminal }[] = [
  { id: "opencode", label: "OpenCode", icon: Bot },
  { id: "claude-code", label: "Claude Code", icon: FileCode2 },
  { id: "hermes", label: "Hermes Agent", icon: Cpu },
  { id: "direct", label: "Terminal", icon: Terminal },
];

const FORMATS: { id: AgentFormat; label: string }[] = [
  { id: "agents", label: "AGENTS.md" },
  { id: "claude", label: "CLAUDE.md" },
  { id: "cursor", label: ".cursor/rules" },
  { id: "cline", label: "CLINE.md" },
  { id: "windsurf", label: ".windsurf/rules" },
  { id: "copilot", label: "Copilot" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "Codex" },
  { id: "all", label: "Semua Format" },
];

function buildCommand(tab: CommandTab, targetDir: string, blueprintId: string, blueprintTitle: string): string {
  const workdir = targetDir.replace(/\\/g, "/");
  switch (tab) {
    case "opencode":
      return (
        `cd "${workdir}" && opencode prompt "` +
        `Jalankan rancang_execution_prompt(blueprint_id="${blueprintId}") untuk blueprint "${blueprintTitle}". ` +
        `Ambil task pertama dengan rancang_next_task, implementasi + verifikasi, lalu rancang_task_complete. Ulangi sampai semua task selesai."`
      );
    case "claude-code":
      return (
        `cd "${workdir}" && claude --prompt "` +
        `Jalankan eksekusi blueprint ${blueprintId} (${blueprintTitle}). ` +
        `Gunakan MCP rancang untuk mengambil task, implementasi, verifikasi, dan tandai selesai."`
      );
    case "hermes":
      return (
        `hermes mcp tool rancang rancang_execution_prompt blueprint_id="${blueprintId}" && ` +
        `hermes mcp tool rancang rancang_next_task blueprint_id="${blueprintId}"`
      );
    case "direct":
    default:
      return (
        `# 1. Buka folder proyek\ncd "${workdir}"\n` +
        `# 2. Baca AGENTS.md untuk instruksi lengkap\ncat AGENTS.md\n` +
        `# 3. Mulai agent coding dengan MCP rancang\nopencode`
      );
  }
}

export function ScaffoldDialog({ blueprintId, blueprintTitle, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [targetDir, setTargetDir] = useState("");
  const [format, setFormat] = useState<AgentFormat>("agents");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScaffoldResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cmdCopied, setCmdCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<CommandTab>("opencode");
  const [recommended, setRecommended] = useState<string | null>(null);

  // Auto-detect best format on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/mcp/detect")
      .then((r) => r.json())
      .then((d) => {
        setRecommended(d.recommended || null);
        if (d.recommended && d.recommended !== "all") {
          setFormat(d.recommended);
        }
      })
      .catch(() => {});
  }, [open]);

  async function handleScaffold() {
    if (!targetDir.trim() || !blueprintId) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/mcp/scaffold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blueprintId, targetDir: targetDir.trim(), format }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Gagal menulis file scaffold");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    const cmd = buildCommand(activeTab, result.targetDir, result.blueprintId, blueprintTitle);
    navigator.clipboard.writeText(cmd);
    setCmdCopied(true);
    setTimeout(() => setCmdCopied(false), 2000);
  }

  const currentCmd = result ? buildCommand(activeTab, result.targetDir, result.blueprintId, blueprintTitle) : "";

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResult(null); setError(null); } }}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" disabled={disabled || !blueprintId}>
            <FolderOpen className="h-3.5 w-3.5" />
            Mulai Coding
          </Button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Scaffold: {blueprintTitle}</SheetTitle>
          <SheetDescription>
            Tulis file blueprint ke folder proyek dan salin perintah eksekusi untuk agent coding.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          {/* Target directory input */}
          <div className="space-y-1.5">
            <Label htmlFor="scaffold-dir">Folder Proyek</Label>
            <Input
              id="scaffold-dir"
              placeholder={`Contoh: D:/projects/${blueprintTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Tujuan folder — semua file scaffold akan ditulis di sini.
            </p>
          </div>

          {/* Format selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Format Agent</Label>
              {recommended && (
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                  ✓ Auto-detect: {FORMATS.find((f) => f.id === recommended)?.label || recommended}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    format === f.id
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  } ${f.id === recommended ? "ring-1 ring-blue-500/40" : ""}`}
                >
                  {f.label}
                  {f.id === recommended && " ★"}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                  <Check className="h-4 w-4" />
                  Berhasil! ({result.filesWritten.length} file)
                </div>
                <ul className="mt-2 space-y-1 text-xs text-green-700 dark:text-green-400">
                  {result.filesWritten.map((f) => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3" />
                      <code className="font-mono">{f}</code>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Command Tabs */}
              <div className="space-y-2">
                <Label className="text-xs">Command Eksekusi</Label>
                <div className="flex gap-1 rounded-lg border bg-muted/30 p-0.5">
                  {COMMAND_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = activeTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">
                    {currentCmd}
                  </pre>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1.5 right-1.5"
                    onClick={handleCopy}
                    title="Salin perintah"
                  >
                    {cmdCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeTab === "opencode" && "OpenCode akan buka sesi baru dengan MCP rancang."}
                  {activeTab === "claude-code" && "Claude Code akan membaca blueprint."}
                  {activeTab === "hermes" && "Panggil MCP tools langsung dari CLI."}
                  {activeTab === "direct" && "Buka folder dan baca AGENTS.md untuk instruksi manual."}
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleScaffold}
              disabled={loading || !targetDir.trim() || !blueprintId}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Menulis file…
                </>
              ) : (
                <>
                  <FolderOpen className="h-3.5 w-3.5" />
                  {result ? "Tulis Ulang" : "Scaffold"}
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}