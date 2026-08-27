"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { Download, ChevronDown } from "lucide-react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Composer } from "@/components/chat/composer";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Greeting } from "@/components/chat/greeting";
import { ComparisonView, type ComparisonColumn } from "@/components/chat/comparison-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { streamChat } from "@/hooks/use-chat-stream";
import { conversationStore, type Conversation, type ChatMessageRecord } from "@/lib/storage";
import { useSync } from "@/lib/use-sync";
import { useAuth } from "@/components/auth-provider";
import { SyncIndicator } from "@/components/sync-indicator";
import { AuthGate } from "@/components/auth-gate";

export default function ChatPage() {
  const [models, setModels] = useState<string[]>(["auto"]);
  const [model, setModel] = useState("auto");
  const [compareMode, setCompareMode] = useState(false);
  const [compareModels, setCompareModels] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<{ prompt: string; columns: ComparisonColumn[] } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sync = useSync();
  const { storageVersion } = useAuth();

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
  // so a different identity never sees the previous identity's chats. Also covers
  // first mount (storageVersion starts at 0).
  useEffect(() => {
    setConversations(conversationStore.all());
    setActiveId(null);
    setMessages([]);
    setComparison(null);
  }, [storageVersion]);

  // Refresh the list after Firestore merge lands in localStorage.
  useEffect(() => {
    if (sync.status === "synced") setConversations(conversationStore.all());
  }, [sync.status]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, comparison]);

  const persist = (id: string, msgs: ChatMessageRecord[]) => {
    const firstUser = msgs.find((m) => m.role === "user");
    const conversation: Conversation = {
      id,
      title: firstUser ? firstUser.content.slice(0, 60) : "Chat baru",
      createdAt: conversations.find((c) => c.id === id)?.createdAt ?? Date.now(),
      messages: msgs,
    };
    conversationStore.save(conversation);
    setConversations(conversationStore.all());
    sync.syncConversation(conversation);
  };

  const newChat = () => {
    setActiveId(null);
    setMessages([]);
    setComparison(null);
  };

  const selectChat = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    setActiveId(id);
    setMessages(conv.messages);
    setComparison(null);
  };

  const deleteChat = (id: string) => {
    conversationStore.remove(id);
    setConversations(conversationStore.all());
    sync.deleteConversation(id);
    if (activeId === id) newChat();
  };

  const sendSingle = async (text: string) => {
    setComparison(null);
    const id = activeId ?? nanoid();
    if (!activeId) setActiveId(id);

    const userMsg: ChatMessageRecord = { id: nanoid(), role: "user", content: text };
    const assistantMsg: ChatMessageRecord = { id: nanoid(), role: "assistant", content: "", model };
    const nextMessages = [...messages, userMsg, assistantMsg];
    setMessages(nextMessages);
    setStreamingId(assistantMsg.id);

    try {
      const history = nextMessages
        .slice(0, -1)
        .map((m) => ({ role: m.role, content: m.content }));

      await streamChat(model, history, (chunk) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m))
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: `Error: ${message}` } : m))
      );
    } finally {
      setStreamingId(null);
      setMessages((prev) => {
        persist(id, prev);
        return prev;
      });
    }
  };

  const sendComparison = async (text: string) => {
    if (compareModels.length < 2) return;
    const columns: ComparisonColumn[] = compareModels.map((m) => ({ model: m, content: "", done: false }));
    setComparison({ prompt: text, columns });

    await Promise.all(
      compareModels.map(async (m) => {
        try {
          await streamChat(m, [{ role: "user", content: text }], (chunk) => {
            setComparison((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                columns: prev.columns.map((c) => (c.model === m ? { ...c, content: c.content + chunk } : c)),
              };
            });
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Terjadi kesalahan";
          setComparison((prev) => {
            if (!prev) return prev;
            return { ...prev, columns: prev.columns.map((c) => (c.model === m ? { ...c, error: message } : c)) };
          });
        } finally {
          setComparison((prev) => {
            if (!prev) return prev;
            return { ...prev, columns: prev.columns.map((c) => (c.model === m ? { ...c, done: true } : c)) };
          });
        }
      })
    );
  };

  const busy = streamingId !== null || (comparison ? comparison.columns.some((c) => !c.done) : false);

  // Export the current chat (single or comparison) as a Markdown file.
  const buildChatExport = (): string => {
    if (comparison) {
      const parts: string[] = [`# Chat Multi-Model`, "", `**Prompt:** ${comparison.prompt}`, ""];
      comparison.columns.forEach((col) => {
        parts.push(`## ${col.model}`, "", col.error ? `> Error: ${col.error}` : (col.content || "_(kosong)_"), "");
      });
      return parts.join("\n");
    }
    if (messages.length === 0) return "";
    const firstUser = messages.find((m) => m.role === "user");
    const parts: string[] = [`# Chat${firstUser ? `: ${firstUser.content.slice(0, 80)}` : ""}`, ""];
    messages.forEach((m) => {
      const role = m.role === "user" ? "User" : `Assistant (${m.model ?? "?"})`;
      parts.push(`## ${role}`, "", m.content || "_(kosong)_", "");
    });
    return parts.join("\n");
  };

  const downloadChat = () => {
    const content = buildChatExport();
    if (!content.trim()) return;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const firstUser = messages.find((m) => m.role === "user") ?? comparison?.columns[0];
    const name = firstUser ? `chat-${(comparison?.prompt ?? firstUser.content).slice(0, 40).replace(/[\\/:*?"<>|]/g, "-")}` : "chat";
    a.href = url;
    a.download = `${name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AuthGate>
    <div className="flex flex-1 overflow-hidden">
      <div className="flex h-full shrink-0 flex-col">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectChat}
          onNew={newChat}
          onDelete={deleteChat}
        />
        <SyncIndicator status={sync.status} active={sync.active} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {(messages.length > 0 || comparison) && (
          <div className="flex items-center justify-end gap-2 border-b bg-muted/30 px-4 py-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" title="Unduh chat sebagai Markdown">
                    <Download className="h-3.5 w-3.5" />
                    Unduh Chat
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={downloadChat}>
                  Markdown (.md)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {comparison ? (
          <ComparisonView prompt={comparison.prompt} columns={comparison.columns} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="relative mx-auto flex min-h-full max-w-3xl flex-col gap-5 px-4 py-6 md:gap-7">
              {messages.length === 0 && (
                <div className="flex flex-1 items-center justify-center py-20">
                  <Greeting onPick={(text) => (compareMode ? sendComparison(text) : sendSingle(text))} />
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} streaming={m.id === streamingId} />
              ))}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        )}

        <div className="mx-auto w-full max-w-3xl">
          <Composer
            models={models}
            model={model}
            onModelChange={setModel}
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
            compareModels={compareModels}
            onCompareModelsChange={setCompareModels}
            onSend={compareMode ? sendComparison : sendSingle}
            disabled={busy || (compareMode && compareModels.length < 2)}
          />
        </div>
      </div>
    </div>
    </AuthGate>
  );
}
