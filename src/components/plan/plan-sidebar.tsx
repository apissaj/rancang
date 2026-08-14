"use client";

import { FileText, History, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PlanRecord } from "@/lib/storage";

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

export function PlanSidebar({
  plans,
  activeId,
  onSelect,
  onDelete,
}: {
  plans: PlanRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="flex w-full shrink-0 flex-col border-b bg-muted/20 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Riwayat
        </span>
        <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {plans.length}
        </span>
      </div>
      <ScrollArea className="h-40 lg:h-[calc(100%-2.75rem)]">
        <div className="flex flex-col gap-1 px-2 py-2">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "group flex w-full flex-col gap-0.5 rounded-md border border-transparent px-2.5 py-2 text-left outline-none transition-colors hover:border-border hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50",
                p.id === activeId && "border-border bg-muted"
              )}
              title={p.title}
            >
              <span className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                {p.title}
              </span>
              <span className="truncate pl-[18px] text-[11px] text-muted-foreground">
                {timeAgo(p.createdAt)}
                {p.versions.length > 1 && ` · v${p.versions.length}`}
              </span>
            </button>
          ))}
          {plans.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <div className="flex size-9 items-center justify-center rounded-md border bg-background">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Belum ada PRD</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground/70">
                PRD yang kamu buat akan tersimpan di sini
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
