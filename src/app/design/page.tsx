"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { toastManager } from "@/components/ui/toast";
import { DesignSidebar } from "@/components/design/design-sidebar";
import { SetupForm } from "@/components/design/setup-form";
import { ResultView } from "@/components/design/result-view";
import { designStore, planStore, type DesignRecord, type PlanRecord, type Screen } from "@/lib/storage";
import { buildDesignDoc, type Platform } from "@/lib/design-doc";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <DesignPageInner />
    </Suspense>
  );
}

function DesignPageInner() {
  const [idea, setIdea] = useState("");
  const [sourcePlanId, setSourcePlanId] = useState<string>("none");
  const [vibe, setVibe] = useState("");
  const [platform, setPlatform] = useState<Platform>("mobile");
  const [pwa, setPwa] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [designs, setDesigns] = useState<DesignRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  const [designMd, setDesignMd] = useState("");
  const [screens, setScreens] = useState<Screen[]>([]);

  // MCP Blueprint integration: tracks the bridge blueprint id so the user can
  // copy the ready-to-run execution prompt from the Design tab after generating.
  const [mcpBlueprintId, setMcpBlueprintId] = useState<string | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  const mcpIds = useRef<Record<string, string>>({});

  const sync = useSync();
  const searchParams = useSearchParams();
  const { user, storageVersion } = useAuth();
  const [plans, setPlans] = useState<PlanRecord[]>([]);

  // Clears the working state back to a blank setup form. Used both by the manual
  // "New design" button and by the storageVersion effect (identity switch).
  const resetToSetup = useCallback(() => {
    setActiveId(null);
    setIdea("");
    setSourcePlanId("none");
    setVibe("");
    setPlatform("mobile");
    setPwa(false);
    setDesignMd("");
    setScreens([]);
    setError(null);
    setShowSetup(true);
  }, []);

  useEffect(() => {
    setDesigns(designStore.all());
    setPlans(planStore.all());
    resetToSetup();
    const planId = searchParams.get("planId");
    if (planId) {
      const plan = planStore.all().find((p) => p.id === planId);
      if (plan) {
        setSourcePlanId(planId);
        setIdea(plan.idea || plan.title || "");
        setShowSetup(true);
      }
    }
  }, [storageVersion, resetToSetup, searchParams]);

  const deleteDesign = (id: string) => {
    const target = designStore.all().find((d) => d.id === id);
    designStore.remove(id);
    setDesigns(designStore.all());
    sync.deleteDesignRemote(id);
    if (activeId === id) resetToSetup();
    toastManager.add({
      title: "Desain dihapus",
      description: target ? `"${target.title || "Untitled design"}" telah dihapus.` : undefined,
      type: "success",
    });
  };

  useEffect(() => {
    if (sync.status === "synced") setDesigns(designStore.all());
  }, [sync.status]);

  const activeDesign = activeId ? designs.find((d) => d.id === activeId) ?? null : null;

  const generate = async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);
    setMcpBlueprintId(null);
    const planMarkdown = sourcePlanId !== "none" ? plans.find((p) => p.id === sourcePlanId)?.markdown : undefined;
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ idea, planMarkdown, vibe: vibe || undefined, platform, pwa }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Pembuatan gagal" }))).error ?? "Pembuatan gagal");
      const data = (await res.json()) as { designMd: string; screens: Screen[] };
      const now = Date.now();
      const record: DesignRecord = {
        id: nanoid(),
        title: idea.slice(0, 60),
        sourceIdea: idea,
        sourcePlanId: sourcePlanId !== "none" ? sourcePlanId : undefined,
        platform,
        pwa,
        designMd: data.designMd,
        screens: data.screens,
        createdAt: now,
        versions: [{ id: nanoid(), designMd: data.designMd, screens: data.screens, createdAt: now, source: "generated" }],
      };
      designStore.save(record);
      setDesigns(designStore.all());
      setActiveId(record.id);
      setDesignMd(record.designMd);
      setScreens(record.screens);
      setShowSetup(false);
      sync.syncDesign(record);
      void publishDesignMCP(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const loadDesign = (id: string) => {
    const d = designs.find((x) => x.id === id);
    if (!d) return;
    setActiveId(id);
    setIdea(d.sourceIdea);
    setSourcePlanId(d.sourcePlanId ?? "none");
    setPlatform(d.platform);
    setPwa(d.pwa);
    setDesignMd(d.designMd);
    setScreens(d.screens);
    const mcpId = d.mcpId ?? mcpIds.current[id] ?? null;
    setMcpBlueprintId(mcpId);
    setMcpCopied(false);
    if (mcpId) mcpIds.current[id] = mcpId;
    if (!mcpId && d.designMd) {
      // Design exists but bridge id was lost (pre-persistence record) —
      // re-publish silently so "Salin Prompt MCP" reappears.
      void publishDesignMCP(d);
    }
    setError(null);
    setShowSetup(false);
  };

  // Push the finished design into the MCP blueprint store. When the design came
  // from a plan, it MERGES into that plan's blueprint (prd/spec/plan/tasks +
  // design) so one execution prompt carries everything; otherwise it creates a
  // design-only blueprint. Runs in the background — local UX must not block on
  // the bridge being up.
  const publishDesignMCP = async (record: DesignRecord) => {
    try {
      const designDoc = buildDesignDoc(record.designMd, record.screens);
      let docs: Record<string, string> = { design: designDoc };
      let blueprintId = record.mcpId || mcpIds.current[record.id] || undefined;

      if (record.sourcePlanId) {
        const plan = planStore.all().find((p) => p.id === record.sourcePlanId);
        if (plan) {
          docs = { ...(plan.docs ?? {}), design: designDoc };
          blueprintId = blueprintId || plan.mcpId || mcpIds.current[plan.id] || undefined;
        }
      }

      const res = await fetch("/api/mcp/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: blueprintId,
          title: record.title,
          idea: record.sourceIdea,
          model: "",
          docs,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { id: string };
      mcpIds.current[record.id] = data.id;
      if (record.sourcePlanId) mcpIds.current[record.sourcePlanId] = data.id;
      setMcpBlueprintId(data.id);
      if (data.id !== record.mcpId) {
        const stored = designStore.all().find((d) => d.id === record.id);
        if (stored) {
          designStore.save({ ...stored, mcpId: data.id });
          setDesigns(designStore.all());
        }
      }
    } catch {
      // Bridge down (port 3110) — blueprint stays local, no crash.
    }
  };

  const copyMcpPrompt = async () => {
    if (!mcpBlueprintId) return;
    const fromPlan = !!activeDesign?.sourcePlanId;
    const mcpDocTail = fromPlan
      ? `Blueprint ini berisi PRD, spec, plan, tasks, dan DESIGN.md + wireframe — ikuti semuanya, ` +
        `terutama DESIGN.md untuk implementasi UI/UX.`
      : `Blueprint ini berisi DESIGN.md + wireframe — ikuti desain dan wireframe ini untuk implementasi UI/UX.`;
    try {
      await navigator.clipboard.writeText(
        `Gunakan MCP server "rancang". Ambil execution prompt blueprint ${mcpBlueprintId} ` +
          `(tool rancang_execution_prompt, agent: "Claude Code", working_dir: <path>) lalu kerjakan task-nya ` +
          `satu per satu: rancang_next_task → implementasi + verifikasi → rancang_task_complete. ` +
          mcpDocTail
      );
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 1500);
    } catch {
      setError("Gagal menyalin prompt MCP.");
    }
  };

  return (
    <AuthGate>
      <div className="flex flex-1 flex-col overflow-hidden lg:h-dvh lg:flex-row">
        <div className="flex flex-col">
          <DesignSidebar
            designs={designs}
            activeId={activeId}
            onSelect={loadDesign}
            onNewDesign={resetToSetup}
            onDelete={deleteDesign}
          />
          <SyncIndicator status={sync.status} active={sync.active} />
        </div>

        {showSetup ? (
          <SetupForm
            idea={idea}
            setIdea={setIdea}
            sourcePlanId={sourcePlanId}
            setSourcePlanId={setSourcePlanId}
            plans={plans}
            vibe={vibe}
            setVibe={setVibe}
            platform={platform}
            setPlatform={setPlatform}
            pwa={pwa}
            setPwa={setPwa}
            loading={loading}
            error={error}
            onGenerate={generate}
            hasResult={!!activeDesign}
            onBackToResult={() => setShowSetup(false)}
          />
        ) : (
          <ResultView
            idea={idea}
            vibe={vibe}
            platform={platform}
            pwa={pwa}
            designMd={designMd}
            setDesignMd={setDesignMd}
            screens={screens}
            setScreens={setScreens}
            activeDesign={activeDesign}
            setDesigns={setDesigns}
            sync={sync}
            mcpBlueprintId={mcpBlueprintId}
            mcpCopied={mcpCopied}
            onCopyMcpPrompt={copyMcpPrompt}
            onPublish={publishDesignMCP}
            onEditSetup={() => setShowSetup(true)}
          />
        )}
      </div>
    </AuthGate>
  );
}
