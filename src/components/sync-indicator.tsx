"use client";

import { Loader2, Cloud } from "lucide-react";
import type { SyncStatus } from "@/lib/use-sync";

export function SyncIndicator({ status, active }: { status: SyncStatus; active: boolean }) {
  if (!active || status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
      {status === "syncing" ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
                    Menyinkronkan...
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3" />
                    Tersinkronkan
                  </>
                )}
    </div>
  );
}
