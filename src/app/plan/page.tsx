"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Check, Copy, Download, FileText, Loader2, Bot, ChevronDown, ChevronRight, Bookmark } from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { PlanSidebar } from "@/components/plan/plan-sidebar";
import FeatureMap from "@/components/plan/feature-map";
import { ClarifyQuestions, type QuestionAnswers } from "@/components/plan/clarify-questions";
import { planStore, type PlanRecord, type PlanVersion } from "@/lib/storage";
import type { ClarifyResponse, StructureResponse } from "@/lib/clarify-types";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

const TEMPLATES = [
  { label: "SaaS Dashboard", idea: "Dashboard SaaS analytics di mana user melihat metrik bisnis real-time, membuat laporan otomatis, dan mengundang anggota tim dengan role berbeda." },
  { label: "E-commerce", idea: "Toko online dengan katalog produk, keranjang, checkout, dan riwayat pesanan. Fokus UX mobile-first dan pembayaran mudah." },
  { label: "Landing Page", idea: "Landing page produk dengan hero, fitur, testimoni, dan form waitlist. Fokus konversi dan loading cepat." },
  { label: "Mobile App", idea: "Aplikasi mobile habit tracker di mana pengguna mencatat kebiasaan harian, melihat streak, dan mendapat pengingat." },
  { label: "REST API", idea: "REST API untuk manajemen tugas (CRUD) dengan auth JWT, rate limiting, dan dokumentasi OpenAPI." },
  { label: "Chat Bot", idea: "Chatbot customer service yang menjawab FAQ otomatis, eskalasi ke manusia, dan terintegrasi WhatsApp." },
  { label: "Internal Tool", idea: "Alat internal untuk tim support mencari dan membalas tiket lebih cepat, dengan integrasi CRM dan shortcut." },
  { label: "AI Summarizer", idea: "Ekstensi browser yang merangkum artikel panjang menjadi 3 poin singkat dan bisa disimpan ke koleksi." },
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
  const [mapping, setMapping] = useState(false);
  const [structure, setStructure] = useState<StructureResponse | null>(null);
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
    // Emit content from `s` into `collected`, splitting on markers. Returns the
    // text AFTER the last marker (may contain a marker split across chunks).
    const processBuffer = (s: string): string => {
      DOC_MARKER.lastIndex = 0;
      let pos = 0;
      let m: RegExpExecArray | null;
      let lastMarkerEnd = -1;
      while ((m = DOC_MARKER.exec(s)) !== null) {
        const before = s.slice(pos, m.index);
        if (before) collected[currentDoc] += before;
        currentDoc = m[1];
        pos = m.index + m[0].length;
        lastMarkerEnd = m.index + m[0].length;
      }
      return s.slice(pos);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Keep the tail (could contain a marker split across chunks) in buffer;
      // emit everything up to the last marker.
      const tail = processBuffer(buffer);
      buffer = tail;
      setDocs({ ...collected });
      partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    }
    // Flush whatever remains (trailing content after the last marker, or a doc
    // whose marker never arrived).
    if (buffer.trim()) collected[currentDoc] += buffer;
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
      let collected: Record<string, string> | undefined;
      if (multiMode) {
        collected = await streamMultiDocs(ideaText, model, answers);
        full = collected.prd;
      } else {
        full = await streamOne(ideaText, model, answers, setMarkdown);
      }
      const record: PlanRecord = {
        ...draftRecord,
        markdown: full,
        docs: multiMode && collected ? { ...collected } : undefined,
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
          docs: Object.keys(partial.docs).length > 0 ? { ...partial.docs } : undefined,
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
    buildStructure(payload);
  };

  // After clarify, ask the LLM for a 3-level feature structure, then show it
  // as a mind-map before generating the full PRD.
  const buildStructure = async (answers: Array<{ question: string; selected: string[]; note?: string }>) => {
    setMapping(true);
    setError(null);
    try {
      const res = await fetch("/api/plan/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, answers, model: model || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as StructureResponse;
      setStructure(data);
    } catch (err) {
      console.warn("Structure step failed, falling back to direct generation:", err);
      generatePrd(answers);
    } finally {
      setMapping(false);
    }
  };

  const continueToPrd = () => {
    const answers = clarify?.questions.map((q) => ({
      question: q.question,
      selected: [] as string[],
      note: undefined as string | undefined,
    }));
    setStructure(null);
    setClarify(null);
    generatePrd(answers ?? []);
  };

  const loadPlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setActiveId(id);
    setIdea(plan.idea);
    setMarkdown(plan.markdown);
    setDocs(plan.docs ?? {});
    setActiveDoc(plan.docs?.prd ? "prd" : "prd");
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
  const currentDocContent = multiMode && Object.keys(docs).length > 0 ? docs[activeDoc] || "" : displayedMarkdown;

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

  // Download all available docs (prd/spec/plan/tasks) as a single ZIP file.
  const downloadAllDocs = async () => {
    const zip = new JSZip();
    const folder = zip.folder("prd-docs");
    let count = 0;
    DOC_NAMES.forEach((doc) => {
      const content = docs[doc];
      if (!content || content.length === 0) return;
      folder?.file(`${doc}.md`, content);
      count++;
    });
    if (count === 0) return;
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prd-docs.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a single agent-rules markdown file from all available docs, so a
  // coding agent (Claude Code, Cursor, OpenCode, Copilot, etc.) can consume
  // the blueprint as context. Choose the target format from the button title.
  const buildAgentExport = (format: "AGENTS" | "CLAUDE" | "CURSOR"): string => {
    const heading = format === "AGENTS" ? "AGENTS.md" : format === "CLAUDE" ? "CLAUDE.md" : ".cursorrules";
    const lead =
      format === "AGENTS"
        ? "You are collaborating on this project. Follow the blueprint below."
        : format === "CLAUDE"
          ? "You are Claude Code working on this project. Follow the blueprint below."
          : "Cursor rules: follow the blueprint below while editing this codebase.";
    const parts: string[] = [`# ${heading}`, "", lead, ""];
    DOC_NAMES.forEach((doc) => {
      const content = docs[doc];
      if (!content || content.length === 0) return;
      const label = doc.toUpperCase();
      parts.push(`## ${label}`, "", content.trim(), "");
    });
    return parts.join("\n");
  };

  const downloadAgentExport = (format: "AGENTS" | "CLAUDE" | "CURSOR") => {
    const content = buildAgentExport(format);
    if (!content.trim()) return;
    const name = format === "AGENTS" ? "AGENTS.md" : format === "CLAUDE" ? "CLAUDE.md" : ".cursorrules";
    downloadMarkdown(content, name);
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
        <div className={"flex flex-col gap-3 " + (structure ? "lg:w-full" : "lg:w-1/3")}>
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
            placeholder={`mis. "${TEMPLATES[0].idea}"\n\nIde lain:\n- ${TEMPLATES[1].idea}\n- ${TEMPLATES[2].idea}`}
            className="min-h-[200px] resize-none"
            disabled={!!clarify}
          />
          {!clarify && idea.trim() === "" && (
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" title="Pilih template ide untuk memulai lebih cepat">
                      <Bookmark className="h-3.5 w-3.5" />
                      Template Ide
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="w-80">
                  {TEMPLATES.map((t) => (
                    <DropdownMenuItem
                      key={t.label}
                      onClick={() => setIdea(t.idea)}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="font-medium">
                        {t.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {t.idea.slice(0, 70)}{t.idea.length > 70 ? "…" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-muted-foreground">
                atau tulis ide kamu sendiri di atas
              </span>
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
          {structure && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Stepper current="structure" />
                <Button onClick={continueToPrd} disabled={loading}>
                  Lanjutkan
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <FeatureMap data={structure} />
            </div>
          )}
        </div>

        {!structure && (compareColumns ? (
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
                {multiMode && Object.values(docs).some((c) => c && c.length > 0) && (
                  <Button variant="outline" size="sm" onClick={downloadAllDocs} title="Download semua dokumen jadi satu file ZIP">
                    <Download className="h-3.5 w-3.5" />
                    Unduh Semua (.zip)
                  </Button>
                )}
                {multiMode && Object.values(docs).some((c) => c && c.length > 0) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm" title="Ekspor blueprint sebagai rules file untuk coding agent">
                          <Bot className="h-3.5 w-3.5" />
                          Ekspor untuk Agent
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => downloadAgentExport("AGENTS")}>
                        AGENTS.md <span className="ml-2 text-[10px] text-muted-foreground">(umum)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAgentExport("CLAUDE")}>
                        CLAUDE.md <span className="ml-2 text-[10px] text-muted-foreground">(Claude Code)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadAgentExport("CURSOR")}>
                        .cursorrules <span className="ml-2 text-[10px] text-muted-foreground">(Cursor)</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
                <Markdown content={multiMode && docs[activeDoc] ? docs[activeDoc] : displayedMarkdown} />
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
        ))}
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

const STEPS = ["structure", "prd", "task"] as const;
type StepKey = (typeof STEPS)[number];

const STEP_LABEL: Record<StepKey, string> = {
  structure: "Struktur",
  prd: "PRD",
  task: "Task",
};

function Stepper({ current }: { current: StepKey }) {
  const activeIdx = STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold " +
                (active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-500"
                    : "border-foreground/20 text-muted-foreground")
              }
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={active ? "font-medium" : "text-muted-foreground"}>
              {STEP_LABEL[s]}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 h-px w-8 bg-border" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
function versionLabel(v: PlanVersion, index: number): string {
  const sourceLabel = v.source === "generated" ? "Dibuat" : v.source === "manual-edit" ? "Edit manual" : "Edit AI";
  return `v${index + 1} · ${sourceLabel} · ${timeAgo(v.createdAt)}`;
}
