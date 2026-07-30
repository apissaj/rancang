"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/components/markdown";

export type ComparisonColumn = {
  model: string;
  content: string;
  done: boolean;
  error?: string;
};

export function ComparisonView({ prompt, columns }: { prompt: string; columns: ComparisonColumn[] }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b px-4 py-3 text-sm text-muted-foreground">
        Prompt: <span className="text-foreground">{prompt}</span>
      </div>
      <div className="grid flex-1 grid-cols-1 divide-y overflow-auto sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.model} className="flex min-h-[300px] flex-col">
            <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold">{col.model}</div>
            <ScrollArea className="flex-1 p-3">
              {col.error ? (
                <p className="text-sm text-destructive">{col.error}</p>
              ) : (
                <>
                  <Markdown content={col.content} />
                  {!col.done && !col.content && (
                    <span className="inline-flex gap-1 py-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                    </span>
                  )}
                </>
              )}
            </ScrollArea>
          </div>
        ))}
      </div>
    </div>
  );
}
