"use client";

import Link from "next/link";
import { FolderGit2, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/layout/top-nav";
import { AuthGate } from "@/components/auth-gate";
import { ProjectsStats } from "@/components/projects/projects-stats";
import { ExecTabSelector } from "@/components/projects/exec-tab-selector";
import { TaskSearch } from "@/components/projects/task-search";
import { BlueprintCard } from "@/components/projects/blueprint-card";
import { useProjects } from "@/hooks/use-projects";

export default function ProjectsPage() {
  const ctl = useProjects();
  const { blueprints, loading, error, loadData, execTab, setExecTab } = ctl;

  const totalTasks = blueprints.reduce((acc, b) => acc + (b.tasks?.total || 0), 0);
  const totalDone = blueprints.reduce((acc, b) => acc + (b.tasks?.done || 0), 0);
  const overallPercent = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;

  return (
    <AuthGate>
    <div className="flex flex-1 flex-col overflow-hidden lg:h-dvh lg:flex-row">
      <div className="flex w-full shrink-0 flex-col border-b bg-muted/20 lg:h-full lg:w-72 lg:border-b-0 lg:border-r">
        <AppNav />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 lg:overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Proyek & Task Tracker
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau progres pengerjaan task oleh AI Coding Agent. Centang task langsung dari sini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Segarkan
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/plan" />}>
            <FileText className="h-3.5 w-3.5" />
            Buat Blueprint Baru
          </Button>
        </div>
      </div>

      <ProjectsStats
        blueprintCount={blueprints.length}
        overallPercent={overallPercent}
        totalDone={totalDone}
        totalTasks={totalTasks}
      />

      <ExecTabSelector value={execTab} onChange={setExecTab} />

      {/* Blueprint Cards List */}
      <div className="mt-4 space-y-4">
        <TaskSearch ctl={ctl} />

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && blueprints.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Memuat daftar blueprint dari disk...
          </div>
        )}

        {!loading && blueprints.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
            <FolderGit2 className="h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-4 text-base font-semibold">Belum ada blueprint</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Buat dokumen PRD dan arsitektur terlebih dahulu di tab Rencana.
            </p>
            <Button className="mt-4" nativeButton={false} render={<Link href="/plan" />}>
              Mulai Buat PRD
            </Button>
          </div>
        )}

        {blueprints.map((b) => (
          <BlueprintCard key={b.id} b={b} ctl={ctl} />
        ))}
      </div>
      </div>
    </div>
    </AuthGate>
  );
}
