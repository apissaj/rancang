"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/storage";

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r bg-muted/20">
      <div className="p-2">
        <Button variant="secondary" className="w-full justify-start gap-2 shadow-sm" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="flex flex-col gap-1 pb-2">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                c.id === activeId && "bg-accent"
              )}
            >
              <button
                onClick={() => onSelect(c.id)}
                className="flex-1 truncate text-left"
                title={c.title}
              >
                {c.title || "New chat"}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => onDelete(c.id)}
                aria-label="Delete chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">No conversations yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
