import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectsStats({
  blueprintCount,
  overallPercent,
  totalDone,
  totalTasks,
}: {
  blueprintCount: number;
  overallPercent: number;
  totalDone: number;
  totalTasks: number;
}) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Total Blueprint</CardDescription>
          <CardTitle className="text-2xl font-bold">{blueprintCount}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Tersimpan di disk lokal (~/.rancang/blueprints)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Progres Keseluruhan</CardDescription>
          <CardTitle className="text-2xl font-bold">{overallPercent}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${overallPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {totalDone} dari {totalTasks} task selesai
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Status MCP Bridge</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl font-bold text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            Aktif (:3110)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">8 tools siap dipanggil oleh Coding Agent</p>
        </CardContent>
      </Card>
    </div>
  );
}
