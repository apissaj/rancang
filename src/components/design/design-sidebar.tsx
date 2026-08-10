"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DesignRecord } from "@/lib/storage";

export function DesignSidebar({
  designs,
  activeId,
  onSelect,
}: {
  designs: DesignRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-full shrink-0 border-b bg-muted/20 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Recent Designs
      </div>
      <ScrollArea className="h-40 lg:h-[calc(100%-2rem)]">
        <div className="flex flex-col gap-1 px-2 pb-2 lg:flex-col">
          {designs.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                d.id === activeId && "bg-accent"
              )}
              title={d.title}
            >
              {d.title}
            </button>
          ))}
          {designs.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No designs yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
