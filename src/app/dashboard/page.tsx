"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { conversationStore, planStore, designStore } from "@/lib/storage";

type ModelCount = Record<string, number>;

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    plans: number;
    chats: number;
    designs: number;
    planVersions: number;
    designVersions: number;
    totalChars: number;
    models: ModelCount;
    lastActive: number | null;
  } | null>(null);

  useEffect(() => {
    const plans = planStore.all();
    const chats = conversationStore.all();
    const designs = designStore.all();

    const models: ModelCount = {};
    let totalChars = 0;
    let lastActive: number | null = null;

    plans.forEach((p) => {
      totalChars += (p.markdown || "").length;
      if (p.docs) Object.values(p.docs).forEach((d) => (totalChars += (d || "").length));
      p.versions.forEach((v) => (totalChars += (v.markdown || "").length));
      const t = p.createdAt || 0;
      if (t > (lastActive ?? 0)) lastActive = t;
    });

    chats.forEach((c) => {
      c.messages.forEach((m) => {
        totalChars += (m.content || "").length;
        if (m.role === "assistant" && m.model) {
          models[m.model] = (models[m.model] ?? 0) + 1;
        }
      });
      const t = c.createdAt || 0;
      if (t > (lastActive ?? 0)) lastActive = t;
    });

    designs.forEach((d) => {
      totalChars += (d.designMd || "").length;
      d.versions.forEach((v) => (totalChars += (v.designMd || "").length));
      const t = d.createdAt || 0;
      if (t > (lastActive ?? 0)) lastActive = t;
    });

    const planVersions = plans.reduce((acc, p) => acc + p.versions.length, 0);
    const designVersions = designs.reduce((acc, d) => acc + d.versions.length, 0);

    setStats({
      plans: plans.length,
      chats: chats.length,
      designs: designs.length,
      planVersions,
      designVersions,
      totalChars,
      models,
      lastActive,
    });
  }, []);

  if (!stats) return null;

  const formatChars = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const topModels = Object.entries(stats.models)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan ringan pemakaian Rancang — semua data dihitung langsung dari
          browser kamu (localStorage), tanpa server.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard title="Rencana" value={stats.plans} hint={`${stats.planVersions} versi`} />
        <StatCard title="Chat" value={stats.chats} hint="percakapan" />
        <StatCard title="Desain" value={stats.designs} hint={`${stats.designVersions} versi`} />
        <StatCard
          title="Total Konten"
          value={formatChars(stats.totalChars)}
          hint="karakter"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Model Paling Banyak Dipakai</CardTitle>
          </CardHeader>
          <CardContent>
            {topModels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada chat yang tercatat.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {topModels.map(([model, count]) => (
                  <Badge key={model} variant="secondary" className="font-mono text-xs">
                    {model} · {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktivitas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Total rencana" value={stats.plans} />
            <Row label="Total chat" value={stats.chats} />
            <Row label="Total desain" value={stats.designs} />
            <Row
              label="Aktivitas terakhir"
              value={
                stats.lastActive
                  ? new Date(stats.lastActive).toLocaleString("id-ID")
                  : "—"
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, hint }: { title: string; value: number | string; hint: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-3xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className="text-[11px] text-muted-foreground/70">{hint}</span>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-1 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
