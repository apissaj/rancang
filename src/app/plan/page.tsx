"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { Check, Copy, FileText, Loader2, ChevronDown, Bookmark, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { PlanSidebar } from "@/components/plan/plan-sidebar";
import { ClarifyQuestions, type QuestionAnswers } from "@/components/plan/clarify-questions";
import { PreviewWindow, type PreviewDoc } from "@/components/plan/preview-window";
import { toastManager } from "@/components/ui/toast";
import { planStore, type PlanRecord } from "@/lib/storage";
import type { ClarifyResponse } from "@/lib/clarify-types";
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

type DocStatus = "pending" | "writing" | "done";

export default function PlanPage() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clarifying, setClarifying] = useState(false);
  const [clarify, setClarify] = useState<ClarifyResponse | null>(null);
  const sync = useSync();
  const { storageVersion } = useAuth();

  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const [modelError, setModelError] = useState(false);
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const multiMode = true;
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [mcpBlueprintId, setMcpBlueprintId] = useState<string | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  // Maps a local plan id -> the blueprint id the MCP bridge assigned, so
  // re-publishing after an edit updates the same blueprint instead of cloning.
  const mcpIds = useRef<Record<string, string>>({});
  const [activeDoc, setActiveDoc] = useState("prd");
  // When the user picks a tab manually we stop auto-following the document
  // currently being streamed.
  const manualDocRef = useRef(false);
  // Tracks the latest streamed content so a mid-stream failure can still save a partial draft.
  const partialRef = useRef<{ markdown: string; docs: Record<string, string> }>({ markdown: "", docs: {} });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models: string[]; defaultModel: string }) => {
        setModels(data.models);
        setModel(data.defaultModel);
        setModelError(false);
      })
      .catch(() => { setModelError(true); });
  }, []);

  // Re-read from localStorage whenever the storage scope switches (login/logout)
  // and auto-restore a blueprint pointed to by ?mcpId=. loadPlan is intentionally
  // excluded from deps: it changes identity every render, so including it would
  // re-run this effect on every render and reset the UI.
  useEffect(() => {
    const all = planStore.all();
    setPlans(all);
    setActiveId(null);
    setMcpBlueprintId(null);
    setMcpCopied(false);
    mcpIds.current = {};
    setIdea("");
    setError(null);
    setClarify(null);

    // Auto-restore / import blueprint if ?mcpId= query param is present
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetMcpId = params.get("mcpId");
      if (targetMcpId) {
        const existing = all.find((p) => p.mcpId === targetMcpId);
        if (existing) {
          loadPlan(existing.id);
        } else {
          // Fetch from server disk
          fetch(`/api/mcp/blueprint?id=${encodeURIComponent(targetMcpId)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.blueprint) {
                const b = data.blueprint;
                const newRecord: PlanRecord = {
                  id: nanoid(),
                  title: b.title || "Blueprint " + targetMcpId,
                  idea: b.idea || b.title || "",
                  markdown: b.docs?.prd || Object.values(b.docs || {})[0] || "",
                  createdAt: b.createdAt || Date.now(),
                  versions: [],
                  docs: b.docs || {},
                  mcpId: targetMcpId,
                };
                planStore.save(newRecord);
                const updated = planStore.all();
                setPlans(updated);
                loadPlan(newRecord.id);
              }
            })
            .catch((err) => {
              console.error("[plan] failed to load blueprint by mcpId:", err);
            });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageVersion]);

  // Refresh the list after Firestore merge lands in localStorage.
  useEffect(() => {
    if (sync.status === "synced") setPlans(planStore.all());
  }, [sync.status]);

  const streamMultiDocs = async (ideaText: string, selectedModel: string, answers: Answer[] | undefined) => {
    const res = await fetch("/api/plan/full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abortRef.current?.signal,
      body: JSON.stringify({ idea: ideaText, answers, model: selectedModel }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentDoc = "prd";
    const collected: Record<string, string> = { prd: "", spec: "", plan: "", tasks: "" };
    const DOC_MARKER = /<!-- (\/)?DOC:(\w+) -->/g;
    // Max length of a `<!-- DOC:xxxx -->` marker. We only need to hold this
    // many trailing characters in the buffer to guard against a marker being
    // split across chunk boundaries.
    const DOC_MARKER_LEN = 32;
    // Emit content from `s` into `collected`, splitting on markers. Returns the
    // text AFTER the last marker (may contain a marker split across chunks).
    const DOC_ORDER = ["prd", "spec", "plan", "tasks"] as const;
    const setStatusForDoc = (d: string) => {
      const i = DOC_ORDER.indexOf(d as (typeof DOC_ORDER)[number]);
      const next: Record<string, DocStatus> = {};
      DOC_ORDER.forEach((name, idx) => {
        next[name] = idx < i ? "done" : idx === i ? "writing" : "pending";
      });
      setDocStatus(next);
      if (!manualDocRef.current) setActiveDoc(d);
    };
    manualDocRef.current = false;
    setDocStatus({ prd: "pending", spec: "pending", plan: "pending", tasks: "pending" });
    setStatusForDoc("prd");
    const processBuffer = (s: string): string => {
      DOC_MARKER.lastIndex = 0;
      let pos = 0;
      let m: RegExpExecArray | null;
      while ((m = DOC_MARKER.exec(s)) !== null) {
        const before = s.slice(pos, m.index);
        if (m[1] === "/") {
          if (!(m[2] in collected)) {
            pos = m.index + m[0].length;
            continue;
          }
          const closing = m[2] as keyof typeof collected;
          if (before) collected[closing] += before;
          setDocStatus((prev) => ({ ...prev, [closing]: "done" }));
        } else {
          if (before) collected[currentDoc] += before;
          currentDoc = m[2];
          setStatusForDoc(currentDoc);
        }
        pos = m.index + m[0].length;
      }
      return s.slice(pos);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process markers in the buffer, flushing everything before the last
      // marker into `collected[currentDoc]`.
      buffer = processBuffer(buffer);
      // Keep only the last DOC_MARKER_LEN chars so a marker split across two
      // chunks is not lost; flush the rest into the active doc so the preview
      // streams live instead of appearing all at once at the end.
      if (buffer.length > DOC_MARKER_LEN) {
        const safe = buffer.slice(0, -DOC_MARKER_LEN);
        collected[currentDoc] += safe;
        buffer = buffer.slice(-DOC_MARKER_LEN);
      }
      setDocs({ ...collected });
      partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    }
    // Flush whatever remains (trailing content after the last marker, or a doc
    // whose marker never arrived).
    // First re-scan the tail for markers that were held back across chunks.
    buffer = processBuffer(buffer);
    if (buffer.trim()) collected[currentDoc] += buffer;
    setDocs({ ...collected });
    setDocStatus({ prd: "done", spec: "done", plan: "done", tasks: "done" });
    partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    return collected;
  };

  const generatePrd = async (answers?: Answer[]) => {
    setError(null);
    setMcpBlueprintId(null);
    setMcpCopied(false);
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

    setLoading(true);
    setDocs({});
    setDocStatus({});
    abortRef.current = new AbortController();
    try {
      const collected = await streamMultiDocs(ideaText, model, answers);
      const full = collected.prd;
      const record: PlanRecord = {
        ...draftRecord,
        markdown: full,
        docs: { ...collected },
        versions: [{ id: nanoid(), markdown: full, createdAt: now, source: "generated" }],
      };
      planStore.save(record);
      setPlans(planStore.all());
      setActiveId(record.id);
      sync.syncPlan(record);
      setIdea("");
      void publishMCP(record, { silent: true });
    } catch (err) {
      const aborted = (err as Error | undefined)?.name === "AbortError";
      if (!aborted) setError(err instanceof Error ? err.message : "Terjadi kesalahan");
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
      }
    } finally {
      setLoading(false);
    }
  };

  // Push a finished blueprint to the MCP bridge so coding agents (Claude Code,
  // Cursor, Codex, Hermes) can pull it via the rancang_* MCP tools. Runs in the
  // background: local generation must never fail because the bridge is down.
  const publishMCP = async (record: PlanRecord, opts?: { silent?: boolean }) => {
    if (!record.docs || Object.keys(record.docs).length === 0) return;
    try {
      const res = await fetch("/api/mcp/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mcpIds.current[record.id],
          title: record.title,
          idea: record.idea,
          model: modelRef.current,
          docs: record.docs,
        }),
      });
      if (!res.ok) {
        if (!opts?.silent) setError("Blueprint tersimpan lokal, tapi gagal dikirim ke MCP bridge.");
        return;
      }
      const data = (await res.json()) as { id: string };
      mcpIds.current[record.id] = data.id;
      setMcpBlueprintId(data.id);
      // Persist the bridge-assigned id on the record so a page reload or plan
      // switch can restore the "Salin Prompt MCP" button without re-publishing.
      if (data.id !== record.mcpId) {
        const stored = planStore.all().find((p) => p.id === record.id);
        if (stored) planStore.save({ ...stored, mcpId: data.id });
      }
      if (!opts?.silent) setMcpCopied(true);
    } catch {
      if (!opts?.silent) setError("Blueprint tersimpan lokal, tapi MCP bridge tidak jalan (port 3110?).");
    }
  };

  const copyMcpPrompt = async () => {
    if (!mcpBlueprintId) return;
    const hasDesign = !!docs.design?.trim();
    const mcpDocTail = hasDesign
      ? `Blueprint ini berisi PRD, spec, plan, tasks, dan DESIGN.md + wireframe — ikuti semuanya, ` +
        `terutama DESIGN.md untuk implementasi UI/UX.`
      : `Blueprint ini berisi PRD, spec, plan, tasks. ` +
        `(DESIGN.md akan menyusul jika kamu membuat desain dari PRD ini.) ` +
        `Ikuti blueprint ini saat mengimplementasi, sesuai urutan tugas.`;
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

  const startGenerate = async () => {
    if (!idea.trim() || loading || clarifying) return;
    setClarifying(true);
    setError(null);
    setNotice(null);
    abortRef.current = new AbortController();
    try {
      const res = await fetch("/api/plan/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
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
      if ((err as Error | undefined)?.name === "AbortError") {
        return;
      }
      console.warn("Clarify step failed, falling back to direct generation:", err);
      setNotice("Klarifikasi dilewati karena gagal dimuat — PRD dibuat langsung dari ide kamu.");
      await generatePrd();
    } finally {
      setClarifying(false);
      abortRef.current = null;
    }
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setClarifying(false);
    setLoading(false);
    setDocStatus({});
    setError(null);
  };

  const submitAnswers = (answers: QuestionAnswers) => {
    if (!clarify) return;
    const payload = clarify.questions.map((q) => ({
      question: q.question,
      selected: answers[q.id]?.selected ?? [],
      note: answers[q.id]?.note,
    }));
    setClarify(null);
    generatePrd(payload);
  };

  const skipClarify = () => {
    setClarify(null);
    generatePrd();
  };

  const loadPlan = (id: string) => {
    if (loading) {
      setNotice("Tunggu pembuatan PRD selesai sebelum membuka PRD lain.");
      return;
    }
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setActiveId(id);
    setIdea(plan.idea);
    setDocs(plan.docs ?? {});
    setActiveDoc("prd");
    setDocStatus({});
    setError(null);
    setClarify(null);
    // Restore the MCP blueprint id saved on the record (if any) so the
    // "Salin Prompt MCP" button reappears after reload/plan-switch; older
    // records that predate persistence just fall back to re-publishing.
    const hadMcp = mcpIds.current[id];
    const mcpId = plan.mcpId ?? hadMcp ?? null;
    setMcpBlueprintId(mcpId);
    setMcpCopied(false);
    if (mcpId) mcpIds.current[id] = mcpId;
    if (plan.docs && !mcpId && !hadMcp) {
      // Published once (bridge still has it) but id lost pre-persistence —
      // re-publish silently once per session to get a fresh id so the button shows.
      void publishMCP(plan, { silent: true });
    }
  };

  const activePlan = activeId ? plans.find((p) => p.id === activeId) ?? null : null;

  const startNewPlan = () => {
    setActiveId(null);
    setIdea("");
    setDocs({});
    setDocStatus({});
    setMcpBlueprintId(null);
    setMcpCopied(false);
    setError(null);
    setClarify(null);
    setClarifying(false);
    setActiveDoc("prd");
    manualDocRef.current = false;
  };

  const handleDelete = (id: string) => {
    const removed = plans.find((p) => p.id === id);
    planStore.remove(id);
    setPlans(planStore.all());
    if (activeId === id) {
      setActiveId(null);
      setIdea("");
      setDocs({});
      setDocStatus({});
      setClarify(null);
      setError(null);
    }
    setClarifying(false);
    toastManager.add({
      title: "PRD dihapus",
      description: removed ? `"${removed.title}" telah dihapus.` : undefined,
      type: "success",
    });
  };

  const activeContent = docs[activeDoc] || "";

  return (
    <AuthGate>
    <div className="flex flex-1 flex-col overflow-hidden lg:h-dvh lg:flex-none lg:flex-row">
      <div className="flex min-h-0 flex-col">
        <PlanSidebar
          plans={plans}
          activeId={activeId}
          onSelect={loadPlan}
          onDelete={handleDelete}
          onNew={startNewPlan}
        />
        <SyncIndicator status={sync.status} active={sync.active} />
      </div>

      <div className="thin-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row lg:overflow-hidden lg:px-6 lg:pb-6 lg:pt-0">
        <div className="thin-scrollbar flex min-h-0 flex-col gap-3 lg:w-1/3 lg:overflow-y-auto">
          <div className="flex h-14 shrink-0 items-center border-b px-4">
            <h1 className="text-xl font-semibold tracking-tight">Jelaskan ide kamu</h1>
          </div>
          <p className="px-4 text-sm text-muted-foreground">
            Dapatkan PRD terstruktur dengan tujuan, kebutuhan, dan rincian task langkah demi langkah.
          </p>
          {activePlan && !clarify && (
            <p className="px-4 text-xs text-muted-foreground">
              Sedang membuka: <span className="truncate font-medium text-foreground">{activePlan.title}</span>
            </p>
          )}

          <div className="flex items-center gap-2 rounded-lg border bg-background/60 p-2.5">
            <Label htmlFor="model-select" className="text-sm text-muted-foreground">Model AI</Label>
            <Select value={model} onValueChange={(v) => v && setModel(v)} disabled={models.length === 0}>
              <SelectTrigger id="model-select" className="h-8 min-w-0 flex-1">
                <SelectValue placeholder="Memuat model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {modelError && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Gagal memuat daftar model. Coba refresh halaman atau periksa koneksi.
            </div>
          )}

          <Textarea
            id="idea-input"
            name="idea"
            aria-label="Ide aplikasi atau fitur"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={`mis. "${TEMPLATES[0].idea}"\n\nIde lain:\n- ${TEMPLATES[1].idea}\n- ${TEMPLATES[2].idea}`}
            className={`thin-scrollbar h-44 resize-none overflow-y-auto ${clarify ? "hidden" : ""}`}
          />
          {idea.length > 0 && !clarify && (
            <p className="-mt-1 text-right text-xs text-muted-foreground">
              {idea.length} / 10.000 karakter
            </p>
          )}
          {clarify && (
            <p className="break-words rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
              Ide: {idea}
            </p>
          )}
          {!clarify && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="h-9 text-sm" title="Pilih template ide untuk memulai lebih cepat">
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
                      <span className="text-xs text-muted-foreground">
                        {t.idea.slice(0, 70)}{t.idea.length > 70 ? "…" : ""}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {idea.trim() === "" && (
                <span className="text-xs text-muted-foreground">
                  atau tulis ide kamu sendiri di atas
                </span>
              )}
            </div>
          )}
          {!clarify && (
            <Button
              onClick={startGenerate}
              disabled={loading || clarifying || !idea.trim()}
              title={idea.trim() ? undefined : "Tulis ide terlebih dahulu"}
              className="w-full"
            >
              {(loading || clarifying) && <Loader2 className="h-4 w-4 animate-spin" />}
              {clarifying ? "Menganalisis ide kamu..." : loading ? "Membuat..." : "Buat PRD"}
            </Button>
          )}
          {(loading || clarifying) && (
            <Button
              variant="outline"
              onClick={cancelGenerate}
              className="w-full"
              title="Hentikan pembuatan. Dokumen yang sudah selesai akan tetap disimpan sebagai draft."
            >
              Batal
            </Button>
          )}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {notice}
            </div>
          )}
          {clarify && (
            <ClarifyQuestions
              clarify={clarify}
              onSubmit={submitAnswers}
              onSkip={skipClarify}
              submitting={loading}
            />
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-2/3">
          <PreviewWindow
            activeDoc={activeDoc as PreviewDoc}
            multiMode={multiMode}
            docs={docs}
            onSelectDoc={(doc) => {
              manualDocRef.current = true;
              setActiveDoc(doc);
            }}
            progress={loading && multiMode && Object.keys(docStatus).length > 0 ? docStatus : undefined}
            isGenerating={loading && multiMode}
            statusText={
              loading
                ? "Menulis dokumen..."
                : `${(activeContent || "").split(/\s+/).filter(Boolean).length} kata`
            }
            actions={
              <>
                {activePlan && !loading && (
                  <span className={cn("text-xs", mcpBlueprintId ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {mcpBlueprintId ? "MCP: terkirim" : "MCP: belum terkirim"}
                  </span>
                )}
                {mcpBlueprintId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyMcpPrompt}
                    title="Salin prompt siap-tempel untuk agent coding kamu"
                    className="min-w-[9.5rem]"
                  >
                    {mcpCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="truncate">{mcpCopied ? "Prompt tersalin" : "Salin Prompt MCP"}</span>
                  </Button>
                )}
                {activePlan && (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false} render={<Link href={`/design?planId=${activePlan.id}`} />}
                    title="Buat desain visual dan prototype wireframe dari PRD ini"
                  >
                    <Palette className="h-3.5 w-3.5" />
                    Buat Desain
                  </Button>
                )}
              </>
            }
          >
            {loading && multiMode && docStatus[activeDoc] !== "done" && !docs[activeDoc]?.trim() ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {docStatus[activeDoc] === "writing"
                    ? `Menulis ${activeDoc.toUpperCase()}...`
                    : `Menunggu ${activeDoc.toUpperCase()}...`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {docStatus[activeDoc] === "writing"
                    ? "Isi dokumen akan muncul di sini saat model mulai menulis."
                    : "Dokumen ini ditulis setelah dokumen sebelumnya selesai."}
                </p>
              </div>
            ) : activeContent ? (
              <Markdown content={activeContent} />
            ) : (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-lg border bg-muted/30">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Pratinjau PRD</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    PRD yang kamu buat akan tampil di sini.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Mulai dari kolom kiri, lalu klik Buat PRD.
                  </p>
                </div>
              </div>
            )}
          </PreviewWindow>
        </div>
      </div>
    </div>
    </AuthGate>
  );
}

type Answer = { question: string; selected: string[]; note?: string };


