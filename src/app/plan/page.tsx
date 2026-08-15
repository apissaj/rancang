"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Check, Copy, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { PlanSidebar } from "@/components/plan/plan-sidebar";
import { ClarifyQuestions, type QuestionAnswers } from "@/components/plan/clarify-questions";
import { planStore, type PlanRecord, type PlanVersion } from "@/lib/storage";
import type { ClarifyResponse } from "@/lib/clarify-types";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

const EXAMPLES = [
  "Aplikasi pelacak kebiasaan di mana pengguna mencatat kebiasaan harian dan melihat streak",
  "Ekstensi Chrome yang merangkum artikel panjang menjadi 3 poin singkat",
  "Alat internal untuk agen support mencari dan membalas tiket lebih cepat",
];

type CompareColumn = {
  model: string;
  content: string;
  done: boolean;
  error?: string;
  copied?: boolean;
};

export default function PlanPage() {
  const [idea, setIdea] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [clarify, setClarify] = useState<ClarifyResponse | null>(null);
  const sync = useSync();
  const { storageVersion } = useAuth();

  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [compareColumns, setCompareColumns] = useState<CompareColumn[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null); // null = current
  const [multiMode, setMultiMode] = useState(true);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState("prd");
  // Tracks the latest streamed content so a mid-stream failure can still save a partial draft.
  const partialRef = useRef<{ markdown: string; docs: Record<string, string> }>({ markdown: "", docs: {} });
  const DOC_NAMES = ["prd", "spec", "plan", "tasks"] as const;

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: string[]; defaultModel: string }) => {
        setModels(data.models);
        setModel(data.defaultModel);
      })
      .catch(() => {});
  }, []);

  // Re-read from localStorage whenever the storage scope switches (login/logout),
  // so a different identity never sees the previous identity's plans. Also covers
  // first mount (storageVersion starts at 0).
  useEffect(() => {
    setPlans(planStore.all());
    setActiveId(null);
    setIdea("");
    setMarkdown("");
    setError(null);
    setClarify(null);
    setCompareColumns(null);
  }, [storageVersion]);

  // Refresh the list after Firestore merge lands in localStorage.
  useEffect(() => {
    if (sync.status === "synced") setPlans(planStore.all());
  }, [sync.status]);

  const toggleCompareModel = (m: string) => {
    if (compareModels.includes(m)) {
      setCompareModels(compareModels.filter((x) => x !== m));
    } else if (compareModels.length < 3) {
      setCompareModels([...compareModels, m]);
    }
  };

  const streamOne = async (
    ideaText: string,
    selectedModel: string,
    answers: Answer[] | undefined,
    onChunk: (chunk: string) => void
  ) => {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: ideaText, answers, model: selectedModel }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      full += decoder.decode(value, { stream: true });
      onChunk(full);
      partialRef.current = { markdown: full, docs: { prd: full } };
    }
    return full;
  };

  const streamMultiDocs = async (ideaText: string, selectedModel: string, answers: Answer[] | undefined) => {
    const res = await fetch("/api/plan/full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: ideaText, answers, model: selectedModel }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentDoc = "prd";
    const collected: Record<string, string> = { prd: "", spec: "", plan: "", tasks: "" };
    const DOC_MARKER = /<!-- DOC:(\w+) -->/g;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // split on markers; content before marker goes to currentDoc
      let m: RegExpExecArray | null;
      let lastIndex = 0;
      DOC_MARKER.lastIndex = 0;
      while ((m = DOC_MARKER.exec(buffer)) !== null) {
        const before = buffer.slice(lastIndex, m.index);
        if (before) collected[currentDoc] += before;
        currentDoc = m[1];
        lastIndex = m.index + m[0].length;
      }
      const tail = buffer.slice(lastIndex);
      buffer = "";
      if (tail) {
        // could be partial marker — keep last 30 chars in buffer, emit rest
        const keep = Math.min(tail.length, 40);
        const emitPart = tail.slice(0, tail.length - keep);
        if (emitPart) collected[currentDoc] += emitPart;
        buffer = tail.slice(tail.length - keep);
      }
      setDocs({ ...collected });
      partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    }
    // flush remaining buffer
    if (buffer) collected[currentDoc] += buffer;
    setDocs({ ...collected });
    partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    return collected;
  };

  const generatePrd = async (answers?: Answer[]) => {
    setError(null);
    setMarkdown("");
    setActiveId(null);
    setClarify(null);
    const ideaText = idea;
    const now = Date.now();
    const recordId = nanoid();
    const draftRecord: PlanRecord = {
      id: recordId,
      title: ideaText.slice(0, 60),
      idea: ideaText,
      markdown: "",
      createdAt: now,
      versions: [],
    };
    // Save a draft record immediately so navigation/refresh mid-stream never loses the plan.
    planStore.save(draftRecord);
    setPlans(planStore.all());

    if (compareMode && compareModels.length >= 2) {
      setLoading(true);
      const columns: CompareColumn[] = compareModels.map((m) => ({ model: m, content: "", done: false }));
      setCompareColumns(columns);
      setIdea("");

      await Promise.all(
        compareModels.map(async (m) => {
          try {
            const full = await streamOne(ideaText, m, answers, (chunk) => {
              setCompareColumns((prev) => prev?.map((c) => (c.model === m ? { ...c, content: chunk } : c)) ?? prev);
            });
            const now = Date.now();
            const record: PlanRecord = {
              id: nanoid(),
              title: `${ideaText.slice(0, 60)} (${m})`,
              idea: ideaText,
              markdown: full,
              createdAt: now,
              versions: [{ id: nanoid(), markdown: full, createdAt: now, source: "generated" }],
            };
            planStore.save(record);
            sync.syncPlan(record);
          } catch (err) {
            const message = err instanceof Error ? err.message : "Terjadi kesalahan";
            setCompareColumns((prev) => prev?.map((c) => (c.model === m ? { ...c, error: message } : c)) ?? prev);
          } finally {
            setCompareColumns((prev) => prev?.map((c) => (c.model === m ? { ...c, done: true } : c)) ?? prev);
          }
        })
      );
      // Draft record (empty) is only useful if nothing else saved; remove it.
      planStore.remove(recordId);
      setPlans(planStore.all());
      setLoading(false);
      return;
    }

    setLoading(true);
    setCompareColumns(null);
    setDocs({});
    try {
      let full: string;
      if (multiMode) {
        const collected = await streamMultiDocs(ideaText, model, answers);
        full = collected.prd;
      } else {
        full = await streamOne(ideaText, model, answers, setMarkdown);
      }
      const record: PlanRecord = {
        ...draftRecord,
        markdown: full,
        versions: [{ id: nanoid(), markdown: full, createdAt: now, source: "generated" }],
      };
      planStore.save(record);
      setPlans(planStore.all());
      setActiveId(record.id);
      setViewingVersionId(null);
      setEditing(false);
      sync.syncPlan(record);
      setIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      // Preserve whatever streamed so far as a recoverable draft instead of an empty shell.
      const partial = partialRef.current;
      if (partial.markdown) {
        const partialRecord: PlanRecord = {
          ...draftRecord,
          markdown: partial.markdown,
          versions: [{ id: nanoid(), markdown: partial.markdown, createdAt: now, source: "generated" }],
        };
        planStore.save(partialRecord);
        setPlans(planStore.all());
        setActiveId(partialRecord.id);
        setMarkdown(partial.markdown);
      }
    } finally {
      setLoading(false);
    }
  };

  const startGenerate = async () => {
    if (!idea.trim() || loading || clarifying) return;
    setClarifying(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as ClarifyResponse;
      if (data.questions?.length > 0) {
        setClarify(data);
      } else {
        await generatePrd();
      }
    } catch (err) {
      console.warn("Clarify step failed, falling back to direct generation:", err);
      await generatePrd();
    } finally {
      setClarifying(false);
    }
  };

  const submitAnswers = (answers: QuestionAnswers) => {
    if (!clarify) return;
    const payload = clarify.questions.map((q) => ({
      question: q.question,
      selected: answers[q.id]?.selected ?? [],
      note: answers[q.id]?.note,
    }));
    generatePrd(payload);
  };

  const loadPlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setActiveId(id);
    setIdea(plan.idea);
    setMarkdown(plan.markdown);
    setError(null);
    setClarify(null);
    setCompareColumns(null);
    setEditing(false);
    setViewingVersionId(null);
    setAiInstruction("");
  };

  const activePlan = activeId ? plans.find((p) => p.id === activeId) ?? null : null;
  const versions = activePlan?.versions ?? [];
  const viewedVersion = viewingVersionId ? versions.find((v) => v.id === viewingVersionId) ?? null : null;
  const displayedMarkdown = viewedVersion ? viewedVersion.markdown : markdown;
  const currentDocContent = multiMode ? docs[activeDoc] || "" : displayedMarkdown;

  const persistNewVersion = (record: PlanRecord, version: PlanVersion) => {
    const updated: PlanRecord = { ...record, markdown: version.markdown, versions: [...record.versions, version] };
    planStore.save(updated);
    sync.syncPlan(updated);
    setPlans(planStore.all());
    setMarkdown(updated.markdown);
    setViewingVersionId(null);
    return updated;
  };

  const startEdit = () => {
    setEditDraft(markdown);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = () => {
    if (!activePlan) return;
    persistNewVersion(activePlan, {
      id: nanoid(),
      markdown: editDraft,
      createdAt: Date.now(),
      source: "manual-edit",
    });
    setEditing(false);
  };

  const runAiEdit = async () => {
    if (!activePlan || !aiInstruction.trim() || aiEditing) return;
    setAiEditing(true);
    setError(null);
    const instruction = aiInstruction;
    try {
      const res = await fetch("/api/plan/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, instruction }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMarkdown(full);
      }
      persistNewVersion(activePlan, {
        id: nanoid(),
        markdown: full,
        createdAt: Date.now(),
        source: "ai-edit",
        note: instruction,
      });
      setAiInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAiEditing(false);
    }
  };

  const restoreVersion = () => {
    if (!activePlan || !viewedVersion) return;
    persistNewVersion(activePlan, {
      id: nanoid(),
      markdown: viewedVersion.markdown,
      createdAt: Date.now(),
      source: "manual-edit",
      note: `Restored from v${versions.findIndex((v) => v.id === viewedVersion.id) + 1}`,
    });
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(currentDocContent || markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadMarkdown = (content: string, name = "prd.md") => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyColumn = async (m: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCompareColumns((prev) => prev?.map((c) => (c.model === m ? { ...c, copied: true } : c)) ?? prev);
    setTimeout(() => {
      setCompareColumns((prev) => prev?.map((c) => (c.model === m ? { ...c, copied: false } : c)) ?? prev);
    }, 1500);
  };

  return (
    <AuthGate>
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      <div className="flex flex-col">
        <PlanSidebar plans={plans} activeId={activeId} onSelect={loadPlan} />
        <SyncIndicator status={sync.status} active={sync.active} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
        <div className="flex flex-col gap-3 lg:w-1/3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Jelaskan ide kamu</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dapatkan PRD terstruktur dengan tujuan, kebutuhan, dan rincian task langkah demi langkah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/60 p-2.5">
            <div className="flex items-center gap-2">
              <Switch id="compare-mode" checked={compareMode} onCheckedChange={setCompareMode} />
              <Label htmlFor="compare-mode" className="text-sm">
                              Bandingkan model
                            </Label>
            </div>
            {!compareMode ? (
              <Select value={model} onValueChange={(v) => v && setModel(v)}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex flex-wrap gap-1">
                {models.map((m) => (
                  <Badge
                    key={m}
                    variant={compareModels.includes(m) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleCompareModel(m)}
                  >
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          {compareMode && compareModels.length < 2 && (
            <p className="text-xs text-muted-foreground">Pilih 2-3 model untuk dibandingkan.</p>
          )}
          {compareMode && compareModels.length >= 3 && (
            <p className="text-xs text-muted-foreground">Maksimal 3 model.</p>
          )}

          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={`mis. "${EXAMPLES[0]}"\n\nIde lain:\n- ${EXAMPLES[1]}\n- ${EXAMPLES[2]}`}
            className="min-h-[200px] resize-none"
            disabled={!!clarify}
          />
          {!clarify && idea.trim() === "" && (
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setIdea(ex)}
                  className="rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-muted hover:text-foreground"
                >
                  {ex.slice(0, 48)}{ex.length > 48 ? "…" : ""}
                </button>
              ))}
            </div>
          )}
          {!clarify && (
            <Button
              onClick={startGenerate}
              disabled={loading || clarifying || !idea.trim() || (compareMode && compareModels.length < 2)}
              className="w-full sm:w-auto"
            >
              {(loading || clarifying) && <Loader2 className="h-4 w-4 animate-spin" />}
              {clarifying ? "Menganalisis ide kamu..." : loading ? "Membuat..." : "Buat PRD"}
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {clarify && (
            <ClarifyQuestions
              clarify={clarify}
              onSubmit={submitAnswers}
              onSkip={() => generatePrd()}
              submitting={loading}
            />
          )}
        </div>

        {compareColumns ? (
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-2/3">
            <div className="grid flex-1 grid-cols-1 divide-y overflow-auto sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
              {compareColumns.map((col) => (
                <div key={col.model} className="flex min-h-[300px] flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                    <span className="text-xs font-semibold">{col.model}</span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => copyColumn(col.model, col.content)}
                        disabled={!col.done || !col.content}
                      >
                        {col.copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => downloadMarkdown(col.content, `prd-${col.model.replace(/\//g, "-")}.md`)}
                        disabled={!col.done || !col.content}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-3">
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm lg:w-2/3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Pratinjau
              </span>
              {multiMode && !compareColumns && (
                <div className="flex items-center gap-1 rounded-lg border bg-background/60 p-1">
                  {DOC_NAMES.map((doc) => (
                    <button
                      key={doc}
                      onClick={() => setActiveDoc(doc)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        activeDoc === doc
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      {doc}.md
                      {docs[doc] && <span className="ml-1 text-[10px]">{docs[doc].length > 0 ? "●" : ""}</span>}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {activePlan && versions.length > 0 && !editing && (
                  <Select
                    value={viewingVersionId ?? "current"}
                    onValueChange={(v) => setViewingVersionId(v === "current" ? null : v)}
                  >
                    <SelectTrigger className="h-8 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...versions].reverse().map((v) => {
                        const idx = versions.findIndex((x) => x.id === v.id);
                        const isLatest = idx === versions.length - 1;
                        return (
                          <SelectItem key={v.id} value={isLatest ? "current" : v.id}>
                            {versionLabel(v, idx)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                {!editing && currentDocContent && !loading && (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    Ubah
                  </Button>
                )}
                {editing && (
                  <>
                    <Button size="sm" onClick={saveEdit}>
                      Simpan
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      Batal
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={copyMarkdown} disabled={!currentDocContent && !markdown}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Tersalin" : multiMode ? `Salin ${activeDoc}` : "Salin"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadMarkdown(multiMode ? currentDocContent : markdown, multiMode ? `${activeDoc}.md` : undefined)} disabled={!currentDocContent && !markdown}>
                  <Download className="h-3.5 w-3.5" />
                  {multiMode ? "Unduh .md" : "Unduh"}
                </Button>
              </div>
            </div>
            {!editing && (currentDocContent || markdown) && !loading && activePlan && (
              <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2">
                <input
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder="Ubah bagian X jadi... / Tambah section tentang... / Buat goals lebih spesifik"
                  className="h-8 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  disabled={aiEditing}
                />
                <Button size="sm" onClick={runAiEdit} disabled={aiEditing || !aiInstruction.trim()}>
                  {aiEditing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {aiEditing ? "Merevisi..." : "Revisi"}
                </Button>
              </div>
            )}
            {viewedVersion && (
              <div className="flex items-center justify-between gap-2 border-b bg-amber-500/10 px-4 py-2 text-sm">
                <span>
                  Melihat v{versions.findIndex((v) => v.id === viewedVersion.id) + 1} (bukan terbaru)
                </span>
                <Button size="sm" variant="outline" onClick={restoreVersion}>
                  Pulihkan versi ini
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-auto p-4">
              {editing ? (
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="h-full min-h-[300px] resize-none font-mono text-xs"
                />
              ) : displayedMarkdown || (multiMode && docs[activeDoc]) ? (
                <Markdown content={multiMode ? docs[activeDoc] || "" : displayedMarkdown} />
              ) : (
                <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex size-14 items-center justify-center rounded-lg border bg-muted/30">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    PRD yang kamu buat akan tampil streaming di sini secara langsung.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </AuthGate>
  );
}

type Answer = { question: string; selected: string[]; note?: string };

function timeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}j lalu`;
  return `${Math.floor(hours / 24)}h lalu`;
}

function versionLabel(v: PlanVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Dibuat" : v.source === "manual-edit" ? "Edit manual" : "Edit AI";
  return `v${index + 1} · ${sourceLabel} · ${timeAgo(v.createdAt)}`;
}
