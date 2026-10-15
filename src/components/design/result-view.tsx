"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, Copy, Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { ScaffoldDialog } from "@/components/scaffold-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { WireframeCanvas, MockupCanvas } from "@/components/design/wireframe-canvas";
import { GenerationProgress } from "@/components/design/generation-progress";
import { designStore, type DesignRecord, type Screen } from "@/lib/storage";
import { versionLabel, type Platform } from "@/lib/design-doc";
import type { useSync } from "@/lib/use-sync";
import { useDesignImages } from "@/hooks/use-design-images";
import { useDesignVersions } from "@/hooks/use-design-versions";
import { useDesignExport } from "@/hooks/use-design-export";

export function ResultView({
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
  mcpBlueprintId,
  mcpCopied,
  onCopyMcpPrompt,
  onPublish,
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
  setDesigns: Dispatch<SetStateAction<DesignRecord[]>>;
  sync: ReturnType<typeof useSync>;
  mcpBlueprintId: string | null;
  mcpCopied: boolean;
  onCopyMcpPrompt: () => void;
  onPublish: (record: DesignRecord) => Promise<void>;
  onEditSetup: () => void;
}) {
  const platforms: ("mobile" | "web")[] = platform === "both" ? ["mobile", "web"] : [platform];
  const [activeTab, setActiveTab] = useState<"mobile" | "web">(platforms[0]);
  const [currentScreenId, setCurrentScreenId] = useState<{ mobile?: string; web?: string }>({});
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [viewMode, setViewMode] = useState<"wireframe" | "hifi">("wireframe");

  const tabScreens = screens.filter((s) => s.platform === activeTab);
  const currentId = currentScreenId[activeTab] ?? tabScreens[0]?.id;
  const currentScreen = tabScreens.find((s) => s.id === currentId) ?? tabScreens[0];
  const currentIndex = tabScreens.findIndex((s) => s.id === currentScreen?.id);

  const navigate = (id: string) => {
    if (tabScreens.some((s) => s.id === id)) {
      setCurrentScreenId((prev) => ({ ...prev, [activeTab]: id }));
    }
  };

  const {
    generatingId,
    imageError,
    bulkProgress,
    genStartedAt,
    genJustSucceeded,
    generateImage,
    generateAllForTab,
  } = useDesignImages({ screens, setScreens, designMd, activeDesign, setDesigns, sync });

  const {
    versions,
    viewedVersion,
    editing,
    setEditing,
    editDraft,
    setEditDraft,
    aiInstruction,
    setAiInstruction,
    aiEditing,
    error,
    viewingVersionId,
    setViewingVersionId,
    startEdit,
    saveEdit,
    runAiEdit,
    restoreVersion,
  } = useDesignVersions({ designMd, setDesignMd, screens, setScreens, activeDesign, setDesigns, sync, onPublish });

  const displayedMd = viewedVersion ? viewedVersion.designMd : designMd;

  // See the note in SetupForm: Base UI needs `items` to label the trigger, else it shows raw ids.
  const screenItems = tabScreens.map((s) => ({ value: s.id, label: s.name }));
  const versionItems = [...versions].reverse().map((v) => {
    const idx = versions.findIndex((x) => x.id === v.id);
    return { value: idx === versions.length - 1 ? "current" : v.id, label: versionLabel(v, idx) };
  });

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(designMd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { exportingZip, exportError, withImages, downloadMarkdown, exportWireframe, exportHifi } = useDesignExport({
    idea,
    platform,
    pwa,
    designMd,
    screens,
    activeDesign,
  });

  const produce = () => {
    if (activeDesign) {
      const upToDate = activeDesign.designMd === designMd && JSON.stringify(activeDesign.screens) === JSON.stringify(screens);
      if (!upToDate) {
        const updated = { ...activeDesign, designMd, screens };
        designStore.save(updated);
        sync.syncDesign(updated);
        setDesigns(designStore.all());
        void onPublish(updated);
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
            title={withImages.length === 0 ? "Buat minimal satu gambar mockup dulu" : `Membuat zip ${withImages.length} mockup dengan DESIGN.md`}
          >
            {exportingZip ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exportingZip ? "Mengompres..." : "Export aset hi-fi"}
          </Button>
          {mcpBlueprintId && (
            <Button variant="outline" size="sm" onClick={onCopyMcpPrompt} title="Salin prompt siap-tempel untuk agent coding kamu (berisi PRD + DESIGN)">
              <Copy className="h-3.5 w-3.5" />
              {mcpCopied ? "Prompt tersalin" : "Salin Prompt MCP"}
            </Button>
          )}
          {mcpBlueprintId && (
            <ScaffoldDialog
              blueprintId={mcpBlueprintId}
              blueprintTitle={activeDesign?.title ?? "Desain"}
            />
          )}
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
                  {m === "wireframe" ? "Wireframe" : "Mockup Hi-fi"}
                </button>
              ))}
            </div>
            {viewMode === "hifi" && (
              <Button variant="outline" size="sm" onClick={() => generateAllForTab(tabScreens)} disabled={!!bulkProgress || !!generatingId}>
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
                      <p className="text-xs text-muted-foreground">Mungkin butuh sampai satu menit.</p>
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
              <span>Melihat v{versions.findIndex((v) => v.id === viewedVersion.id) + 1} (bukan terbaru)</span>
              <Button size="sm" variant="outline" onClick={restoreVersion}>
                Pulihkan versi ini
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