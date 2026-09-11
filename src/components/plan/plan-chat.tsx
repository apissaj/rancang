"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Loader2, Send, Sparkles, Wand2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Markdown } from "@/components/markdown";
import type { BlueprintChatMessage } from "@/lib/storage";

const QUICK_PROMPTS = [
  "Ringkas blueprint ini dalam 5 poin",
  "Task mana yang paling berisiko gagal? Kenapa?",
  "Apa yang masih belum jelas / kurang di SPEC?",
  "Periksa: apakah semua FR sudah punya task di TASKS?",
];

// Messages the user is likely asking us to *change* something, not just explain.
// Used only to relabel the placeholder — the model decides what to actually say.
const EDIT_HINTS = /\b(tambah|tambahkan|ubah|ganti|hapus|hapuskan|pecah|perbaiki|revisi|buat|jadikan|pindah|rename|add|change|remove|replace|split|fix)\b/i;

export function PlanChat({
  docs,
  activeDoc,
  messages,
  onMessagesChange,
  model,
  onApply,
}: {
  docs: Record<string, string>;
  activeDoc: string;
  messages: BlueprintChatMessage[];
  onMessagesChange: (next: BlueprintChatMessage[]) => void;
  model?: string;
  onApply: (doc: string, content: string, final?: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Which assistant message is being applied to a document right now.
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const docNames = ["prd", "spec", "plan", "tasks"].filter((d) => docs[d]?.trim());

  const hasDocs = docNames.length > 0;

  // Keep the newest message in view as the reply streams in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, streamText]);

  const send = async () => {
    const message = input.trim();
    if (!message || streaming || !hasDocs) return;
    setError(null);
    setInput("");

    const userMsg: BlueprintChatMessage = {
      id: nanoid(),
      role: "user",
      content: message,
      createdAt: Date.now(),
    };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const withUser = [...messages, userMsg];
    onMessagesChange(withUser);
    setStreaming(true);
    setStreamText("");

    try {
      const res = await fetch("/api/plan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docs, history, message, model }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setStreamText(full);
      }
      setStreamText("");
      onMessagesChange([
        ...withUser,
        { id: nanoid(), role: "assistant", content: full, createdAt: Date.now() },
      ]);
    } catch (err) {
      setStreamText("");
      setError(err instanceof Error ? err.message : "Gagal menghubungi model.");
      // Keep the user's message so retrying doesn't lose it.
      onMessagesChange(withUser);
    } finally {
      setStreaming(false);
    }
  };

  // Turn an assistant reply into a rewrite of one document, streaming the
  // result back word by word so the user sees the document changing.
  const applyToDoc = async (target: string, reply: BlueprintChatMessage) => {
    const request = [...messages].reverse().find((m) => m.role === "user" && m.createdAt <= reply.createdAt);
    if (!request) return;
    setApplyingId(reply.id);
    setError(null);
    try {
      const res = await fetch("/api/plan/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docs,
          target,
          model,
          instruction:
            `Permintaan pengguna: ${request.content}\n\n` +
            `Pendekatan yang sudah disetujui (terapkan ini ke dokumen):\n${reply.content}`,
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        // Live-preview the rewrite in the document pane.
        onApply(target, full);
      }
      // Final pass: commit the rewrite as a new version + republish to MCP.
      onApply(target, full, true);
      onMessagesChange(
        messages.map((m) => (m.id === reply.id ? { ...m, appliedDoc: target } : m))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menerapkan ke dokumen.");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Tanya blueprint
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => onMessagesChange([])}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Bersihkan
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3">
        {messages.length === 0 && !streamText && (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              Tanya apa saja soal PRD, SPEC, PLAN, atau TASKS. Kalau jawabannya berupa perubahan,
              tekan <span className="font-medium text-foreground">Terapkan</span> untuk menulis ulang
              dokumennya.
            </p>
            <div className="flex flex-col gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="rounded-md border border-dashed px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted/50 hover:text-foreground"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-1">
              {m.role === "user" ? (
                <div className="self-end rounded-lg bg-foreground px-2.5 py-1.5 text-sm text-background">
                  {m.content}
                </div>
              ) : (
                <div className="rounded-lg border bg-background/60 p-2.5">
                  <Markdown content={m.content} />
                  <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
                    {m.appliedDoc ? (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Check className="h-2.5 w-2.5" />
                        diterapkan ke {m.appliedDoc}.md
                      </Badge>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              disabled={applyingId !== null || docNames.length === 0}
                            >
                              {applyingId === m.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Wand2 className="h-3 w-3" />
                              )}
                              {applyingId === m.id ? "Menulis..." : "Terapkan ke"}
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          }
                        />
                        <DropdownMenuContent align="start">
                          {docNames.map((d) => (
                            <DropdownMenuItem key={d} onClick={() => applyToDoc(d, m)}>
                              {d}.md
                              {d === activeDoc && (
                                <span className="ml-2 text-[10px] text-muted-foreground">(aktif)</span>
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground"
                      onClick={() =>
                        onMessagesChange(messages.filter((x) => x.id !== m.id))
                      }
                      disabled={applyingId !== null}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {streamText && (
            <div className="rounded-lg border bg-background/60 p-2.5">
              <Markdown content={streamText} />
            </div>
          )}
          {streaming && !streamText && (
            <span className="inline-flex gap-1 pl-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            </span>
          )}
        </div>
      </div>

      {error && <p className="border-t px-3 py-2 text-xs text-destructive">{error}</p>}

      <div className="flex items-end gap-2 border-t p-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          disabled={streaming || !hasDocs}
          placeholder={
            !hasDocs
              ? "Buat PRD dulu untuk mulai bertanya"
              : EDIT_HINTS.test(input)
                ? "Minta perubahan, lalu tekan Terapkan pada jawabannya"
                : "Tanya apa saja soal blueprint ini..."
          }
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button size="sm" onClick={send} disabled={streaming || !input.trim() || !hasDocs}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
