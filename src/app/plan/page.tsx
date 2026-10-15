"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { Check, Copy, FileText, Loader2, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { PlanSidebar } from "@/components/plan/plan-sidebar";
import type { QuestionAnswers } from "@/components/plan/clarify-questions";
import { IdeaForm } from "@/components/plan/idea-form";
import { PREVIEW_DOCS, PreviewWindow, type PreviewDoc } from "@/components/plan/preview-window";
import { toastManager } from "@/components/ui/toast";
import { planStore, type PlanRecord } from "@/lib/storage";
import type { ClarifyResponse } from "@/lib/clarify-types";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";
import { useTypewriter } from "@/hooks/use-typewriter";
import { usePlanStream, splitAllDocErrors, type Answer, type DocStatus } from "@/hooks/use-plan-stream";
import { useMcpPublish } from "@/hooks/use-mcp-publish";

export default function PlanPage() {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [clarifying, setClarifying] = useState(false);
  const [clarifyElapsed, setClarifyElapsed] = useState(0);
  const [clarify, setClarify] = useState<ClarifyResponse | null>(null);
  const sync = useSync();
  const { user, storageVersion } = useAuth();

  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const [modelError, setModelError] = useState(false);
  const [docStatus, setDocStatus] = useState<Record<string, DocStatus>>({});
  const [docs, setDocs] = useState<Record<string, string>>({});
  const { typeCursor, setTypingActive, resetTypeCursor, typing } = useTypewriter({
    active: loading,
    docs,
    docStatus,
  });
  const { publishMCP, copyMcpPrompt, mcpBlueprintId, setMcpBlueprintId, mcpCopied, setMcpCopied, mcpIds } = useMcpPublish({
    getDocs: () => docs,
    modelRef,
    setError,
  });
  const [activeDoc, setActiveDoc] = useState("prd");
  const [copiedDoc, setCopiedDoc] = useState(false);
  // When the user picks a tab manually we stop auto-following the document
  // currently being streamed.
  const manualDocRef = useRef(false);
  // Tracks the latest streamed content so a mid-stream failure can still save a partial draft.
  const partialRef = useRef<{ markdown: string; docs: Record<string, string> }>({ markdown: "", docs: {} });
  const abortRef = useRef<AbortController | null>(null);
  const mcpVerifyRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (!clarifying) {
      setClarifyElapsed(0);
      return;
    }
    const id = setInterval(() => {
      setClarifyElapsed((s) => s + 1);
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [clarifying]);

  // Refresh the list after Firestore merge lands in localStorage.
  useEffect(() => {
    if (sync.status === "synced") setPlans(planStore.all());
  }, [sync.status]);

  const { streamMultiDocs, fetchSingleDoc, docErrors, setDocErrors } = usePlanStream({
    setDocs,
    setDocStatus,
    manualDocRef,
    partialRef,
    getSignal: () => abortRef.current?.signal,
    getToken: async () => (user ? await user.getIdToken() : null),
  });
  const [retryingDoc, setRetryingDoc] = useState<PreviewDoc | null>(null);

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
    setDocErrors({});
    setRetryingDoc(null);
    resetTypeCursor();
    setTypingActive(true);
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
      void publishMCP(record, { silent: true, onPublished: (r) => sync.syncPlan(r) });
    } catch (err) {
      setTypingActive(false);
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

  const startGenerate = async () => {
    if (!idea.trim() || loading || clarifying) return;
    setClarifying(true);
    setError(null);
    setNotice(null);
    abortRef.current = new AbortController();
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/plan/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    setTypingActive(false);
    setDocStatus({});
    setError(null);
    setRetryingDoc(null);
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
    // Skip can be triggered while the clarify fetch is still in flight (the
    // "Lewati, langsung buat" hint). Abort it so startGenerate's resolve can't
    // start a second generation or reopen the questions.
    abortRef.current?.abort();
    abortRef.current = null;
    setClarifying(false);
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
    setTypingActive(false);
    const cleaned = splitAllDocErrors(plan.docs ?? {});
    setDocs(plan.docs ? cleaned.docs : {});
    setActiveDoc("prd");
    setDocStatus({});
    setError(null);
    setClarify(null);
    setDocErrors(cleaned.errors);
    setRetryingDoc(null);
    // Restore the MCP blueprint id saved on the record (if any). The id is only
    // trusted after a live check against the bridge — records may hold an id
    // whose blueprint file was deleted, and showing that id would make the
    // "Salin Prompt MCP" button copy a dead id. So a stored id is treated as a
    // candidate: verify it exists via GET /api/mcp/blueprint?id=...; on success
    // keep it (and backfill mcpIds), on 404/network failure fall back to a
    // silent re-publish when the docs are present or leave the button hidden.
    const hadMcp = mcpIds.current[id];
    const mcpId = plan.mcpId ?? hadMcp ?? null;
    delete mcpIds.current[id];
    setMcpBlueprintId(null);
    setMcpCopied(false);
    mcpVerifyRef.current?.abort();
    const verify = new AbortController();
    mcpVerifyRef.current = verify;
    const republish = () => {
      if (plan.docs && Object.keys(plan.docs).length > 0) void publishMCP(plan, { silent: true, onPublished: (r) => sync.syncPlan(r) });
    };
    if (!mcpId) {
      republish();
      return;
    }
    fetch(`/api/mcp/blueprint?id=${encodeURIComponent(mcpId)}`, { signal: verify.signal })
      .then((res) => {
        if (verify.signal.aborted) return;
        if (res.ok) {
          mcpIds.current[id] = mcpId;
          setMcpBlueprintId(mcpId);
          return;
        }
        if (res.status === 404) {
          const current = planStore.all().find((p) => p.id === id);
          if (current) {
            const clean: PlanRecord = { ...current };
            delete clean.mcpId;
            planStore.save(clean);
            setPlans(planStore.all());
          }
        }
        republish();
      })
      .catch(() => {});
  };

  const activePlan = activeId ? plans.find((p) => p.id === activeId) ?? null : null;

  const startNewPlan = () => {
    setActiveId(null);
    setIdea("");
    setTypingActive(false);
    setDocs({});
    setDocStatus({});
    setMcpBlueprintId(null);
    setMcpCopied(false);
    setError(null);
    setClarify(null);
    setClarifying(false);
    setActiveDoc("prd");
    manualDocRef.current = false;
    setDocErrors({});
    setRetryingDoc(null);
  };

  const handleDelete = (id: string) => {
    const removed = plans.find((p) => p.id === id);
    planStore.remove(id);
    setPlans(planStore.all());
    if (activeId === id) {
      setActiveId(null);
      setIdea("");
      setTypingActive(false);
      setDocs({});
      setDocStatus({});
      setClarify(null);
      setError(null);
      setDocErrors({});
      setRetryingDoc(null);
    }
    setClarifying(false);
    toastManager.add({
      title: "PRD dihapus",
      description: removed ? `"${removed.title}" telah dihapus.` : undefined,
      type: "success",
    });
  };

  const writingDoc: PreviewDoc | null = typing ? PREVIEW_DOCS[typeCursor.idx] : null;
  const displayStatus = {} as Record<PreviewDoc, DocStatus>;
  const displayedDocs: Record<string, string> = { ...docs };
  PREVIEW_DOCS.forEach((doc, i) => {
    if (!typing) {
      displayStatus[doc] = "done";
    } else if (i < typeCursor.idx) {
      displayStatus[doc] = "done";
    } else if (i === typeCursor.idx) {
      displayStatus[doc] = "writing";
      displayedDocs[doc] = (docs[doc] ?? "").slice(0, typeCursor.shown);
    } else {
      displayStatus[doc] = "pending";
      displayedDocs[doc] = "";
    }
  });
  const activeStatus = displayStatus[activeDoc as PreviewDoc];
  const activeDocError = docErrors[activeDoc];
  const canRetry = !loading && !clarifying && !typing && !retryingDoc && !!activePlan;

  const retryDoc = async (doc: PreviewDoc) => {
    if (!activePlan || retryingDoc) return;
    const plan = activePlan;
    setRetryingDoc(doc);
    try {
      const { content, error: docError } = await fetchSingleDoc(doc, plan.idea, modelRef.current);
      if (docError) {
        setDocErrors((prev) => ({ ...prev, [doc]: docError }));
        return;
      }
      if (!content.trim()) {
        setDocErrors((prev) => ({ ...prev, [doc]: "Model tidak mengembalikan isi." }));
        return;
      }
      const nextDocs = { ...(plan.docs ?? {}), [doc]: content };
      const record: PlanRecord = {
        ...plan,
        docs: nextDocs,
        markdown: doc === "prd" ? content : plan.markdown,
      };
      planStore.save(record);
      setPlans(planStore.all());
      setDocs(nextDocs);
      setDocErrors((prev) => ({ ...prev, [doc]: undefined }));
    } catch (err) {
      setDocErrors((prev) => ({ ...prev, [doc]: err instanceof Error ? err.message : "Gagal membuat ulang dokumen." }));
    } finally {
      setRetryingDoc(null);
    }
  };

  useEffect(() => {
    if (!writingDoc || manualDocRef.current) return;
    setActiveDoc(writingDoc);
  }, [writingDoc]);

  const activeContent = displayedDocs[activeDoc] || "";

  const copyDocMarkdown = async () => {
    const content = docs[activeDoc] ?? "";
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedDoc(true);
      setTimeout(() => setCopiedDoc(false), 1500);
    } catch {
      setError("Gagal menyalin markdown.");
    }
  };

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
          <IdeaForm
            idea={idea}
            setIdea={setIdea}
            model={model}
            setModel={setModel}
            models={models}
            modelError={modelError}
            clarify={clarify}
            clarifying={clarifying}
            loading={loading}
            activePlan={activePlan}
            error={error}
            notice={notice}
            startGenerate={startGenerate}
            cancelGenerate={cancelGenerate}
            clarifyElapsed={clarifyElapsed}
            submitAnswers={submitAnswers}
            skipClarify={skipClarify}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:w-2/3">
          <PreviewWindow
            activeDoc={activeDoc as PreviewDoc}
            docs={displayedDocs}
            onSelectDoc={(doc) => {
              manualDocRef.current = true;
              setActiveDoc(doc);
            }}
            progress={typing ? displayStatus : undefined}
            isGenerating={typing}
            followTail={typing}
            tailKey={activeContent.length + typeCursor.idx * 1000000}
            statusText={
              typing
                ? "Menulis dokumen..."
                : `${(activeContent || "").split(/\s+/).filter(Boolean).length} kata`
            }
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyDocMarkdown}
                  disabled={typing || !(docs[activeDoc] ?? "").trim()}
                  title={typing ? "Tunggu dokumen selesai ditulis" : "Salin markdown dokumen ini"}
                >
                  {copiedDoc ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="truncate">{copiedDoc ? "Tersalin" : "Salin Markdown"}</span>
                </Button>
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
            <div className="space-y-3">
            {activeDocError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    Dokumen {activeDoc.toUpperCase()} gagal dibuat: {activeDocError}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryDoc(activeDoc as PreviewDoc)}
                    disabled={!canRetry}
                    title={canRetry ? `Buat ulang dokumen ${activeDoc.toUpperCase()}` : "Tunggu proses selesai"}
                  >
                    {retryingDoc === activeDoc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Coba lagi {activeDoc.toUpperCase()}
                  </Button>
                </div>
              </div>
            )}
            {typing && activeStatus !== "done" && !activeContent.trim() ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                  {activeStatus === "writing"
                    ? `Menulis ${activeDoc.toUpperCase()}...`
                    : `Menunggu ${activeDoc.toUpperCase()}...`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {activeStatus === "writing"
                    ? "Isi dokumen akan muncul di sini saat model mulai menulis."
                    : "Dokumen ini ditulis setelah dokumen sebelumnya selesai."}
                </p>
              </div>
            ) : activeContent ? (
              <Markdown
                content={activeContent}
                cursor={typing && activeStatus === "writing"}
              />
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
            </div>
          </PreviewWindow>
        </div>
      </div>
    </div>
    </AuthGate>
  );
}



