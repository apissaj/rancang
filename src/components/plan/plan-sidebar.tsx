"use client";

import { FileText, History, Plus, Trash2 } from "lucide-react";
import { AppNav } from "@/components/layout/top-nav";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PlanRecord } from "@/lib/storage";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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
  onNew,
}: {
  plans: PlanRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onNew?: () => void;
}) {
  return (
    <div className="flex w-full shrink-0 flex-col border-b bg-muted/20 lg:h-full lg:w-72 lg:border-b-0 lg:border-r">
      <AppNav />
      <div className="flex h-[2.625rem] shrink-0 items-center justify-between px-3 border-b">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Riwayat
        </span>
        <div className="flex items-center gap-1.5">
          <span className="rounded-sm border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {plans.length}
          </span>
          {onNew && (
            <button
              onClick={onNew}
              className="flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground transition-colors hover:bg-muted"
              title="Buat PRD baru"
            >
              <Plus className="h-3 w-3" />
              Baru
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="h-40 lg:h-auto lg:flex-1">
        <div className="flex flex-col gap-1 px-2 py-2">
          {plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group relative flex flex-col",
                "rounded-md border border-transparent transition-colors hover:border-border hover:bg-muted/60",
                p.id === activeId && "border-border bg-muted"
              )}
            >
              <button
                onClick={() => onSelect(p.id)}
                className={cn(
                  "w-full rounded-md px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  onDelete && "pr-9"
                )}
                title={p.title}
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{p.title}</span>
                </span>
                <span className="block truncate pl-[18px] text-xs text-muted-foreground">
                  {p.markdown ? (
                    <>
                      {timeAgo(p.createdAt)}
                      {p.versions.length > 1 && ` · v${p.versions.length}`}
                    </>
                  ) : (
                    <span className="italic text-muted-foreground/60">draft — belum selesai</span>
                  )}
                </span>
              </button>
              {onDelete && (
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-destructive/10 focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
                        aria-label={`Hapus ${p.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    }
                  />
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus PRD ini?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{p.title}&rdquo; akan dihapus permanen, termasuk semua versi dan
                        riwayatnya. Tindakan ini tidak bisa dibatalkan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(p.id)}>Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
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
