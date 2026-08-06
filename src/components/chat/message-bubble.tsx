"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
    <div className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {message.model && (
        <span className="text-xs font-medium text-muted-foreground">{message.model}</span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-2.5 text-sm shadow-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
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
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
    </div>
  );
}
