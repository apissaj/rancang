"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { PlanRecord } from "@/lib/storage";

export function PlanSidebar({
  plans,
  activeId,
  onSelect,
}: {
  plans: PlanRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-full shrink-0 border-b bg-muted/20 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
        Recent PRDs
      </div>
      <ScrollArea className="h-40 lg:h-[calc(100%-2rem)]">
        <div className="flex flex-col gap-1 px-2 pb-2 lg:flex-col">
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={cn(
                "truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                p.id === activeId && "bg-accent"
              )}
              title={p.title}
            >
              {p.title}
            </button>
          ))}
          {plans.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No PRDs yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
