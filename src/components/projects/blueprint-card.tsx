"use client";

import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  GitBranch,
  History,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScaffoldDialog } from "@/components/scaffold-dialog";
import { TaskDetailPanel } from "@/components/projects/task-detail-panel";
import { HistoryPanel, VersionsPanel } from "@/components/projects/history-versions-panels";
import type { ProjectsController } from "@/hooks/use-projects";
import type { BlueprintItem } from "@/lib/projects";

export function BlueprintCard({ b, ctl }: { b: BlueprintItem; ctl: ProjectsController }) {
  const {
    expandedId,
    detail,
    cmdCopied,
    historyFor,
    versionsFor,
    loadDetail,
    copyExecCmd,
    toggleHistory,
    toggleVersions,
  } = ctl;

  const tasksTotal = b.tasks?.total || 0;
  const tasksDone = b.tasks?.done || 0;
  const pct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const hasDesign = b.docs?.includes("design");
  const isExpanded = expandedId === b.id;
  const d = isExpanded ? detail : null;

  return (
    <Card className="transition-all hover:border-foreground/20">
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
        {isExpanded && <TaskDetailPanel d={d} ctl={ctl} />}

        {/* History panel */}
        {historyFor === b.id && <HistoryPanel blueprintId={b.id} ctl={ctl} />}

        {/* Versions panel */}
        {versionsFor === b.id && <VersionsPanel blueprintId={b.id} ctl={ctl} />}
      </CardContent>
    </Card>
  );
}