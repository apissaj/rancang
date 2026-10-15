"use client";

import { GitBranch, Loader2 } from "lucide-react";
import type { ProjectsController } from "@/hooks/use-projects";

export function HistoryPanel({ blueprintId, ctl }: { blueprintId: string; ctl: ProjectsController }) {
  const { historyLoading, historyData, toggleHistory } = ctl;

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground">
          Riwayat Eksekusi
        </p>
        <button
          onClick={() => toggleHistory(blueprintId)}
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
  );
}

export function VersionsPanel({ blueprintId, ctl }: { blueprintId: string; ctl: ProjectsController }) {
  const { versionsLoading, versionsData, toggleVersions } = ctl;

  return (
    <div className="mt-3 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-foreground">
          Versi Blueprint
        </p>
        <button
          onClick={() => toggleVersions(blueprintId)}
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
  );
}
