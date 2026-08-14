"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Check, Copy, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { DesignSidebar } from "@/components/design/design-sidebar";
import { WireframeCanvas, MockupCanvas } from "@/components/design/wireframe-canvas";
import { designStore, planStore, type DesignRecord, type DesignVersion, type Screen } from "@/lib/storage";
import { buildHifiReadme, buildWireframeExport, planLabel, screenFileName } from "@/lib/design-export";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

type Platform = "mobile" | "web" | "both";

export default function DesignPage() {
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

  const sync = useSync();
  const { storageVersion } = useAuth();
  const plans = planStore.all();

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
    resetToSetup();
  }, [storageVersion, resetToSetup]);

  const deleteDesign = (id: string) => {
    const target = designStore.all().find((d) => d.id === id);
    if (!window.confirm(`Delete "${target?.title ?? "this design"}"? This can't be undone.`)) return;
    designStore.remove(id);
    setDesigns(designStore.all());
    sync.deleteDesignRemote(id);
    if (activeId === id) resetToSetup();
  };

  useEffect(() => {
    if (sync.status === "synced") setDesigns(designStore.all());
  }, [sync.status]);

  const activeDesign = activeId ? designs.find((d) => d.id === activeId) ?? null : null;

  const generate = async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);
    const planMarkdown = sourcePlanId !== "none" ? plans.find((p) => p.id === sourcePlanId)?.markdown : undefined;
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, planMarkdown, vibe: vibe || undefined, platform, pwa }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Generation failed" }))).error ?? "Generation failed");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
    setError(null);
    setShowSetup(false);
  };

  return (
    <AuthGate>
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
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
            onEditSetup={() => setShowSetup(true)}
          />
        )}
      </div>
    </AuthGate>
  );
}

function SetupForm({
  idea,
  setIdea,
  sourcePlanId,
  setSourcePlanId,
  plans,
  vibe,
  setVibe,
  platform,
  setPlatform,
  pwa,
  setPwa,
  loading,
  error,
  onGenerate,
  hasResult,
  onBackToResult,
}: {
  idea: string;
  setIdea: (v: string) => void;
  sourcePlanId: string;
  setSourcePlanId: (v: string) => void;
  plans: { id: string; title: string; idea?: string; markdown: string }[];
  vibe: string;
  setVibe: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  pwa: boolean;
  setPwa: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  hasResult: boolean;
  onBackToResult: () => void;
}) {
  // Base UI's <SelectValue> resolves the trigger label from the Root's `items` prop — NOT from
  // the rendered <SelectItem> children. Without `items` it stringifies the raw value, which is
  // why the trigger showed a bare nanoid. planLabel() also guards against a blank title.
  const planItems = [
    { value: "none", label: "None (write idea manually)" },
    ...plans.map((p) => ({ value: p.id, label: planLabel(p) })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {hasResult && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={onBackToResult}>
            <ChevronLeft className="h-4 w-4" /> Back to prototype
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold">Turn an idea into a design</h1>
          <p className="text-sm text-muted-foreground">
            Generates a DESIGN.md token spec plus a clickable wireframe prototype.
          </p>
        </div>

        {plans.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Start from an existing PRD (optional)</Label>
            <Select value={sourcePlanId} onValueChange={(v) => v && setSourcePlanId(v)} items={planItems}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Idea</Label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder='e.g. "A habit tracker app where users log daily habits and see streaks"'
            className="min-h-[120px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Vibe (optional)</Label>
          <Input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="e.g. playful, pastel — or corporate, dark, minimal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Platform</Label>
          <RadioGroup value={platform} onValueChange={(v) => v && setPlatform(v as Platform)} className="flex gap-4">
            {(["mobile", "web", "both"] as const).map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                <RadioGroupItem value={p} /> {p}
              </label>
            ))}
          </RadioGroup>
        </div>

        {platform !== "web" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={pwa} onCheckedChange={(v) => setPwa(!!v)} />
            Progressive Web App (installable)
          </label>
        )}

        <Button onClick={onGenerate} disabled={loading || !idea.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Designing..." : "Generate Design"}
        </Button>
        {loading && <p className="text-xs text-muted-foreground">This can take 10-30s.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}

const GENERATION_STAGE_LABELS = [
  "Composing prompt from your design tokens...",
  "Rendering UI mockup...",
  "Finalizing image...",
];

// Estimated (not real) progress: no streaming signal from the image gateway, so this is a
// client-side asymptotic curve calibrated against a ~50-58s typical generation time.
function GenerationProgress({ startedAt, justSucceeded }: { startedAt: number; justSucceeded: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
  const progress = justSucceeded ? 100 : Math.min(99, 100 * (1 - Math.exp(-elapsedSeconds / 25)));
  const stageLabel = GENERATION_STAGE_LABELS[Math.floor(elapsedSeconds / 5) % GENERATION_STAGE_LABELS.length];
  return (
    <div className="flex w-full max-w-xs flex-col gap-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {Math.floor(elapsedSeconds)}s &middot; {stageLabel}
      </p>
    </div>
  );
}

function ResultView({
  idea,
  vibe,
  platform,
  pwa,
  designMd,
  setDesignMd,
  screens,
  setScreens,
  activeDesign,
  setDesigns,
  sync,
  onEditSetup,
}: {
  idea: string;
  vibe: string;
  platform: Platform;
  pwa: boolean;
  designMd: string;
  setDesignMd: (v: string) => void;
  screens: Screen[];
  setScreens: (v: Screen[]) => void;
  activeDesign: DesignRecord | null;
  setDesigns: (v: DesignRecord[]) => void;
  sync: ReturnType<typeof useSync>;
  onEditSetup: () => void;
}) {
  const platforms: ("mobile" | "web")[] = platform === "both" ? ["mobile", "web"] : [platform];
  const [activeTab, setActiveTab] = useState<"mobile" | "web">(platforms[0]);
  const [currentScreenId, setCurrentScreenId] = useState<{ mobile?: string; web?: string }>({});
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<"wireframe" | "hifi">("wireframe");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [genJustSucceeded, setGenJustSucceeded] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const tabScreens = screens.filter((s) => s.platform === activeTab);
  const currentId = currentScreenId[activeTab] ?? tabScreens[0]?.id;
  const currentScreen = tabScreens.find((s) => s.id === currentId) ?? tabScreens[0];
  const currentIndex = tabScreens.findIndex((s) => s.id === currentScreen?.id);

  const navigate = (id: string) => {
    if (tabScreens.some((s) => s.id === id)) {
      setCurrentScreenId((prev) => ({ ...prev, [activeTab]: id }));
    }
  };

  // Ref mirrors the latest `screens` so sequential calls within the same bulk-generate loop
  // (generateAllForTab awaits generateImage in a for-loop) don't each build off a stale closure
  // of `screens` captured at render time — without this, each finished image overwrote the
  // previous one's result back to "ungenerated" because setScreens is async and the loop body
  // doesn't wait for a re-render between iterations.
  const screensRef = useRef(screens);
  screensRef.current = screens;

  // Same reason as screensRef: a version added mid-bulk-run (e.g. "Revise" while images generate)
  // would otherwise be clobbered by the stale `activeDesign` closure on the next persist.
  const activeDesignRef = useRef(activeDesign);
  activeDesignRef.current = activeDesign;

  const persistScreenImage = (screenId: string, image: string) => {
    const updatedScreens = screensRef.current.map((s) => (s.id === screenId ? { ...s, generatedImage: image } : s));
    screensRef.current = updatedScreens;
    setScreens(updatedScreens);
    const design = activeDesignRef.current;
    if (!design) return;
    const lastIdx = design.versions.length - 1;
    const updatedVersions = design.versions.map((v, i) => (i === lastIdx ? { ...v, screens: updatedScreens } : v));
    const updated: DesignRecord = { ...design, screens: updatedScreens, versions: updatedVersions };
    designStore.save(updated);
    sync.syncDesign(updated);
    setDesigns(designStore.all());
  };

  const generateImage = async (screenId: string, attempt = 1): Promise<void> => {
    const target = screensRef.current.find((s) => s.id === screenId);
    if (!target) return;
    setGeneratingId(screenId);
    setImageError(null);
    setGenStartedAt(Date.now());
    try {
      const res = await fetch("/api/design/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screen: target, designMd, designId: activeDesign?.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Image generation failed" }))).error ?? "Image generation failed");
      const data = (await res.json()) as { imageUrl: string };
      setGenJustSucceeded(true);
      await new Promise((r) => setTimeout(r, 250));
      persistScreenImage(screenId, data.imageUrl);
    } catch (err) {
      // "Failed to fetch" / TypeError = network drop (common on mobile: tab backgrounded mid-request
      // during the 60-120s generation, or a flaky connection). Retry once automatically before
      // surfacing an error, since the image-gen call itself is idempotent (just re-renders the prompt).
      const isNetworkError = err instanceof TypeError;
      if (isNetworkError && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        return generateImage(screenId, attempt + 1);
      }
      setImageError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGeneratingId(null);
      setGenStartedAt(null);
      setGenJustSucceeded(false);
    }
  };

  const generateAllForTab = async () => {
    const pending = tabScreens.filter((s) => !s.generatedImage);
    if (pending.length === 0) return;
    setBulkProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      await generateImage(pending[i].id);
      setBulkProgress({ done: i + 1, total: pending.length });
    }
    setBulkProgress(null);
  };

  const versions = activeDesign?.versions ?? [];
  const viewedVersion = viewingVersionId ? versions.find((v) => v.id === viewingVersionId) ?? null : null;
  const displayedMd = viewedVersion ? viewedVersion.designMd : designMd;

  // See the note in SetupForm: Base UI needs `items` to label the trigger, else it shows raw ids.
  const screenItems = tabScreens.map((s) => ({ value: s.id, label: s.name }));
  const versionItems = [...versions].reverse().map((v) => {
    const idx = versions.findIndex((x) => x.id === v.id);
    return { value: idx === versions.length - 1 ? "current" : v.id, label: versionLabel(v, idx) };
  });

  const persistNewVersion = (version: DesignVersion) => {
    if (!activeDesign) return;
    const updated: DesignRecord = {
      ...activeDesign,
      designMd: version.designMd,
      screens: version.screens,
      versions: [...activeDesign.versions, version],
    };
    designStore.save(updated);
    sync.syncDesign(updated);
    setDesigns(designStore.all());
    setDesignMd(updated.designMd);
    setScreens(updated.screens);
    setViewingVersionId(null);
    return updated;
  };

  const startEdit = () => {
    setEditDraft(designMd);
    setEditing(true);
  };

  const saveEdit = () => {
    persistNewVersion({ id: nanoid(), designMd: editDraft, screens, createdAt: Date.now(), source: "manual-edit" });
    setEditing(false);
  };

  const runAiEdit = async () => {
    if (!activeDesign || !aiInstruction.trim() || aiEditing) return;
    setAiEditing(true);
    setError(null);
    const instruction = aiInstruction;
    try {
      const res = await fetch("/api/design/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designMd, screens, instruction }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Edit failed" }))).error ?? "Edit failed");
      const data = (await res.json()) as { designMd: string; screens: Screen[] };
      persistNewVersion({ id: nanoid(), designMd: data.designMd, screens: data.screens, createdAt: Date.now(), source: "ai-edit", note: instruction });
      setAiInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAiEditing(false);
    }
  };

  const restoreVersion = () => {
    if (!viewedVersion) return;
    persistNewVersion({
      id: nanoid(),
      designMd: viewedVersion.designMd,
      screens: viewedVersion.screens,
      createdAt: Date.now(),
      source: "manual-edit",
      note: `Restored from v${versions.findIndex((v) => v.id === viewedVersion.id) + 1}`,
    });
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(designMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMarkdown = () => download(new Blob([designMd], { type: "text/markdown" }), "design.md");

  const exportWireframe = () => {
    const payload = buildWireframeExport({ design: activeDesign, idea, platform, pwa, designMd, screens });
    download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "wireframe.json");
  };

  const withImages = screens.filter((s) => s.generatedImage);

  const exportHifi = async () => {
    if (withImages.length === 0 || exportingZip) return;
    setExportingZip(true);
    setExportError(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const title = activeDesign?.title || idea.slice(0, 60) || "Untitled design";
      const entries: { name: string; file: string }[] = [];

      for (let i = 0; i < withImages.length; i++) {
        const screen = withImages[i];
        const res = await fetch(screen.generatedImage!);
        if (!res.ok) throw new Error(`Couldn't fetch the mockup for "${screen.name}"`);
        const file = screenFileName(screen, i);
        zip.file(`screens/${file}`, await res.blob());
        entries.push({ name: screen.name, file });
      }

      zip.file("DESIGN.md", designMd);
      zip.file("README.md", buildHifiReadme(title, designMd, entries));
      zip.file("wireframe.json", JSON.stringify(buildWireframeExport({ design: activeDesign, idea, platform, pwa, designMd, screens }), null, 2));
      download(await zip.generateAsync({ type: "blob" }), "hifi-assets.zip");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExportingZip(false);
    }
  };

  const produce = () => {
    if (activeDesign) {
      const upToDate = activeDesign.designMd === designMd && JSON.stringify(activeDesign.screens) === JSON.stringify(screens);
      if (!upToDate) {
        const updated = { ...activeDesign, designMd, screens };
        designStore.save(updated);
        sync.syncDesign(updated);
        setDesigns(designStore.all());
      }
    }
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 3000);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{idea.slice(0, 80)}</span>
          <span className="text-xs text-muted-foreground capitalize">
            · {platform}{pwa && platform !== "web" ? " · PWA" : ""}{vibe && ` · ${vibe}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEditSetup}>
            Edit setup
          </Button>
          <Button variant="outline" size="sm" onClick={exportWireframe} disabled={!designMd}>
            <Download className="h-3.5 w-3.5" /> Export wireframe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportHifi}
            disabled={withImages.length === 0 || exportingZip}
            title={withImages.length === 0 ? "Generate at least one mockup image first" : `Zips ${withImages.length} mockup(s) with DESIGN.md`}
          >
            {exportingZip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exportingZip ? "Zipping..." : "Export hi-fi assets"}
          </Button>
          <Button size="sm" onClick={produce}>
            {confirmed ? <Check className="h-3.5 w-3.5" /> : null}
            {confirmed ? "Ready — copy or download below" : "Produce DESIGN.md"}
          </Button>
        </div>
      </div>
      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      <div className="flex flex-1 flex-col gap-4 overflow-auto lg:flex-row lg:overflow-hidden">
        <div className="flex flex-col gap-3 overflow-auto lg:w-1/2">
          {platform === "both" && (
            <div className="flex gap-1 rounded-lg border p-1 w-fit">
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${activeTab === p ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={currentIndex <= 0} onClick={() => navigate(tabScreens[currentIndex - 1]?.id)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <span className="text-muted-foreground">
              Screen: {currentIndex + 1}/{tabScreens.length}
            </span>
            <Select value={currentScreen?.id ?? ""} onValueChange={(v) => v && navigate(v)} items={screenItems}>
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {screenItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex < 0 || currentIndex >= tabScreens.length - 1}
              onClick={() => navigate(tabScreens[currentIndex + 1]?.id)}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border p-1 w-fit">
              {((["wireframe", "hifi"] as const)).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${viewMode === m ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  {m === "wireframe" ? "Wireframe" : "Hi-fi mockup"}
                </button>
              ))}
            </div>
            {viewMode === "hifi" && (
              <Button variant="outline" size="sm" onClick={generateAllForTab} disabled={!!bulkProgress || !!generatingId}>
                {bulkProgress ? `Generating ${bulkProgress.done}/${bulkProgress.total}...` : "Generate all screens"}
              </Button>
            )}
            {bulkProgress && generatingId && genStartedAt && (
              <GenerationProgress startedAt={genStartedAt} justSucceeded={genJustSucceeded} />
            )}
          </div>
          {imageError && <p className="text-sm text-destructive">{imageError}</p>}

          <div className="flex flex-1 items-start justify-center overflow-auto rounded-xl border bg-muted/10 p-6">
            {currentScreen && designMd && viewMode === "wireframe" && (
              <WireframeCanvas screen={currentScreen} designMd={designMd} pwa={pwa} onNavigate={navigate} />
            )}
            {currentScreen && designMd && viewMode === "hifi" && (
              <div className="flex flex-col items-center gap-3">
                {currentScreen.generatedImage ? (
                  <>
                    <MockupCanvas screen={currentScreen} designMd={designMd} image={currentScreen.generatedImage} />
                    <Button variant="outline" size="sm" onClick={() => generateImage(currentScreen.id)} disabled={generatingId === currentScreen.id}>
                      {generatingId === currentScreen.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {generatingId === currentScreen.id ? "Regenerating..." : "Regenerate"}
                    </Button>
                    {generatingId === currentScreen.id && genStartedAt && !bulkProgress && (
                      <GenerationProgress startedAt={genStartedAt} justSucceeded={genJustSucceeded} />
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                    <Button onClick={() => generateImage(currentScreen.id)} disabled={generatingId === currentScreen.id}>
                      {generatingId === currentScreen.id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {generatingId === currentScreen.id ? "Generating..." : "Generate mockup image"}
                    </Button>
                    {generatingId === currentScreen.id && genStartedAt && !bulkProgress ? (
                      <GenerationProgress startedAt={genStartedAt} justSucceeded={genJustSucceeded} />
                    ) : (
                      <p className="text-xs text-muted-foreground">May take up to a minute.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-1/2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
            <span className="text-sm font-medium">DESIGN.md</span>
            <div className="flex flex-wrap items-center gap-2">
              {activeDesign && versions.length > 0 && !editing && (
                <Select
                  value={viewingVersionId ?? "current"}
                  onValueChange={(v) => setViewingVersionId(v === "current" ? null : v)}
                  items={versionItems}
                >
                  <SelectTrigger className="h-8 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {versionItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEdit}>
                  Edit
                </Button>
              )}
              {editing && (
                <>
                  <Button size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={copyMarkdown}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                <Download className="h-3.5 w-3.5" /> Download .md
              </Button>
            </div>
          </div>

          {!editing && activeDesign && (
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
              <input
                value={aiInstruction}
                onChange={(e) => setAiInstruction(e.target.value)}
                placeholder="Make it darker / Add a settings screen / Use rounder corners"
                className="h-8 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={aiEditing}
              />
              <Button size="sm" onClick={runAiEdit} disabled={aiEditing || !aiInstruction.trim()}>
                {aiEditing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {aiEditing ? "Revising..." : "Revise"}
              </Button>
            </div>
          )}
          {error && <p className="px-4 py-2 text-sm text-destructive">{error}</p>}
          {viewedVersion && (
            <div className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm">
              <span>Viewing v{versions.findIndex((v) => v.id === viewedVersion.id) + 1} (not current)</span>
              <Button size="sm" variant="outline" onClick={restoreVersion}>
                Restore this version
              </Button>
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            {editing ? (
              <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="h-full min-h-[300px] resize-none font-mono text-xs" />
            ) : (
              <Markdown content={displayedMd} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function versionLabel(v: DesignVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Generated" : v.source === "manual-edit" ? "Manual edit" : "AI edit";
  return `v${index + 1} · ${sourceLabel}`;
}
