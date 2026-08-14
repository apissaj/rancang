"use client";

import { useState } from "react";
import { Check, Copy, Hammer, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import type { ChatMessageRecord } from "@/lib/storage";

export function MessageBubble({ message, streaming }: { message: ChatMessageRecord; streaming?: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn("group flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
          isUser ? "border-border bg-muted/40" : "border-border bg-muted/40"
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Hammer className="h-3.5 w-3.5 text-foreground" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2">
          {isUser ? (
            <span className="text-xs font-medium text-muted-foreground">Kamu</span>
          ) : (
            <>
              <span className="text-xs font-medium text-foreground">Rancang</span>
              {message.model && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {message.model}
                </span>
              )}
            </>
          )}
        </div>

        <div
          className={cn(
            "rounded-lg border px-3.5 py-2.5 text-sm",
            isUser
              ? "border-border bg-muted/40"
              : "border-border bg-background"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              <Markdown content={message.content || (streaming ? "" : "")} />
              {streaming && !message.content && (
                <span className="inline-flex gap-1 py-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                </span>
              )}
            </>
          )}
        </div>

        {!isUser && message.content && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
            onClick={copy}
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Tersalin" : "Salin"}
          </Button>
        )}
      </div>
    </div>
  );
}