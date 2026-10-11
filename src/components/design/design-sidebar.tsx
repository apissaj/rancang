"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/layout/top-nav";
import type { DesignRecord } from "@/lib/storage";

export function DesignSidebar({
  designs,
  activeId,
  onSelect,
  onNewDesign,
  onDelete,
}: {
  designs: DesignRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewDesign: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex w-full shrink-0 flex-col border-b bg-muted/20 lg:h-full lg:w-72 lg:border-b-0 lg:border-r">
      <AppNav />
      <div className="p-2">
        <Button variant="secondary" className="w-full justify-start gap-2 shadow-sm" onClick={onNewDesign}>
          <Plus className="h-4 w-4" />
          New design
        </Button>
      </div>
      <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Recent Designs
      </div>
      <ScrollArea className="h-40 lg:h-auto lg:flex-1">
        <div className="flex flex-col gap-1 px-2 pb-2 lg:flex-col">
          {designs.map((d) => (
            <div
              key={d.id}
              className={cn(
                "group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                d.id === activeId && "bg-accent"
              )}
            >
              <button
                onClick={() => onSelect(d.id)}
                className="flex-1 truncate rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                title={d.title}
              >
                {d.title || "Untitled design"}
              </button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Hapus desain ${d.title || "tanpa judul"}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus desain ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{d.title || "Untitled design"}&rdquo; akan dihapus permanen, termasuk semua layar
                      dan gambarnya. Tindakan ini tidak bisa dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(d.id)}>Hapus</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
          {designs.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No designs yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
