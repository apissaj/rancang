"use client";

import { Check, CheckCircle2, Circle, Copy, Eye, Loader2, Network, Sparkles } from "lucide-react";
import { TaskDAG } from "@/components/projects/task-dag";
import type { ProjectsController } from "@/hooks/use-projects";
import type { BlueprintDetail } from "@/lib/projects";

export function TaskDetailPanel({ d, ctl }: { d: BlueprintDetail | null; ctl: ProjectsController }) {
  const {
    detailLoading,
    detailTab,
    setDetailTab,
    togglingTask,
    promptTaskId,
    promptText,
    promptLoading,
    promptCopied,
    setPromptCopied,
    toggleTask,
    fetchTaskPrompt,
  } = ctl;

  return (
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
  );
}
