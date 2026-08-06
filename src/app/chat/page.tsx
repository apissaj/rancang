"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Composer } from "@/components/chat/composer";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ComparisonView, type ComparisonColumn } from "@/components/chat/comparison-view";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      title: firstUser ? firstUser.content.slice(0, 60) : "New chat",
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
      const message = err instanceof Error ? err.message : "Something went wrong";
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
          const message = err instanceof Error ? err.message : "Something went wrong";
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
        {comparison ? (
          <ComparisonView prompt={comparison.prompt} columns={comparison.columns} />
        ) : (
          <ScrollArea className="flex-1">
            <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
              {messages.length === 0 && (
                <p className="mt-12 text-center text-sm text-muted-foreground">
                  Start a conversation below.
                </p>
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
