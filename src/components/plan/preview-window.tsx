"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, FileCheck2, FileCode2, FileCog, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export const PREVIEW_DOCS = ["prd", "spec", "plan", "tasks"] as const;
export type PreviewDoc = (typeof PREVIEW_DOCS)[number];

const DOC_FILE: Record<PreviewDoc, { name: string; icon: typeof FileText }> = {
  prd: { name: "PRD.md", icon: FileText },
  spec: { name: "SPEC.md", icon: FileCode2 },
  plan: { name: "PLAN.md", icon: FileCheck2 },
  tasks: { name: "TASKS.md", icon: FileCog },
};

type DocState = "pending" | "writing" | "done";

export function PreviewWindow({
  activeDoc,
  multiMode,
  docs,
  onSelectDoc,
  actions,
  statusText,
  progress,
  children,
}: {
  activeDoc: PreviewDoc;
  multiMode: boolean;
  docs: Partial<Record<PreviewDoc, string>>;
  onSelectDoc: (doc: PreviewDoc) => void;
  actions?: ReactNode;
  statusText: string;
  progress?: Partial<Record<PreviewDoc, DocState>>;
  children: ReactNode;
}) {
  const current = DOC_FILE[activeDoc];
  const progressDocs = PREVIEW_DOCS.filter((doc) => progress?.[doc]);
  const doneCount = progressDocs.filter((doc) => progress?.[doc] === "done").length;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#FF5F56]" />
          <span className="size-3 rounded-full bg-[#FFBD2E]" />
          <span className="size-3 rounded-full bg-[#27C93F]" />
        </div>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-muted-foreground">
          {current.name}
        </span>
        <div className="w-12 shrink-0" aria-hidden="true" />
      </div>

      {multiMode && (
        <div className="flex items-end overflow-x-auto border-b bg-muted/20">
          {PREVIEW_DOCS.map((doc) => {
            const { name, icon: Icon } = DOC_FILE[doc];
            const isActive = activeDoc === doc;
            const hasContent = !!docs[doc];
            return (
              <button
                key={doc}
                type="button"
                onClick={() => onSelectDoc(doc)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-r px-4 py-2 font-mono text-xs transition-colors",
                  isActive
                    ? "bg-card text-foreground"
                    : "text-muted-foreground/70 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {name}
                {hasContent && <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}

      {progressDocs.length > 0 && (
        <div
          role="progressbar"
          aria-label="Progres pembuatan dokumen"
          aria-valuemin={0}
          aria-valuemax={progressDocs.length}
          aria-valuenow={doneCount}
          className="flex items-center gap-2 border-b bg-muted/10 px-4 py-1.5"
        >
          <div className="flex h-1 flex-1 gap-0.5 overflow-hidden rounded-full">
            {progressDocs.map((doc) => {
              const s = progress?.[doc] ?? "pending";
              return (
                <div
                  key={doc}
                  className={cn(
                    "h-full flex-1 transition-colors duration-500",
                    s === "done" && "bg-emerald-500",
                    s === "writing" && "animate-pulse bg-foreground",
                    s === "pending" && "bg-border"
                  )}
                />
              );
            })}
          </div>
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            {doneCount}/{progressDocs.length}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {multiMode && (
          <div className="hidden w-44 shrink-0 border-r bg-muted/20 sm:block">
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Explorer
            </div>
            <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted-foreground">
              <ChevronDown className="size-3.5" />
              rancang
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 pl-6 text-xs text-muted-foreground">
              <ChevronDown className="size-3.5" />
              docs
            </div>
            {PREVIEW_DOCS.map((doc) => {
              const { name, icon: Icon } = DOC_FILE[doc];
              const isActive = activeDoc === doc;
              return (
                <button
                  key={doc}
                  type="button"
                  onClick={() => onSelectDoc(doc)}
                  className={cn(
                    "flex w-full items-center gap-1.5 px-2 py-1 pl-6 text-left font-mono text-xs transition-colors",
                    isActive
                      ? "border-l-2 border-foreground bg-muted/60 text-foreground"
                      : "text-muted-foreground/70 hover:bg-muted/40"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {actions && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-b px-4 py-2">{actions}</div>
          )}
          <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t bg-muted/40 px-4 py-1.5 font-mono text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <ChevronRight className="size-3" /> main
        </span>
        <span className="ml-auto truncate">{statusText}</span>
        {progressDocs.length > 0 && (
          <span className="shrink-0">· {doneCount}/{progressDocs.length} dokumen</span>
        )}
        <span className="hidden sm:inline">UTF-8</span>
        <span>Markdown</span>
      </div>
    </div>
  );
}
