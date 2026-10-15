"use client";

import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectsController } from "@/hooks/use-projects";

export function TaskSearch({ ctl }: { ctl: ProjectsController }) {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searchLoading,
    searchError,
    runSearch,
  } = ctl;

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground">Daftar Blueprint</h2>
        <div className="flex w-full gap-2 sm:w-auto">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Cari task lintas blueprint..."
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40 sm:w-64"
          />
          <Button variant="outline" size="sm" onClick={runSearch} disabled={searchLoading}>
            {searchLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Cari
          </Button>
        </div>
      </div>

      {searchError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {searchError}
        </div>
      )}

      {searchResults !== null && !searchLoading && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              Hasil pencarian: {searchResults.length} task
            </p>
            <button
              onClick={() => setSearchResults(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Tutup
            </button>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tidak ada task yang cocok.</p>
          ) : (
            <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
              {searchResults.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                >
                  <span
                    className={`mt-0.5 h-3 w-3 shrink-0 rounded-full ${
                      r.done ? "bg-green-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      <span className="font-mono text-muted-foreground">{r.id}</span>{" "}
                      {r.text}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground/70">
                      {r.blueprintId} · {r.phase}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
