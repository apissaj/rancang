"use client";

import { useState, type KeyboardEvent } from "react";
import { Send, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FadeInUp } from "@/components/effects/fade-in-up";

export function Composer({
  models,
  model,
  onModelChange,
  compareMode,
  onCompareModeChange,
  compareModels,
  onCompareModelsChange,
  onSend,
  disabled,
}: {
  models: string[];
  model: string;
  onModelChange: (m: string) => void;
  compareMode: boolean;
  onCompareModeChange: (v: boolean) => void;
  compareModels: string[];
  onCompareModelsChange: (models: string[]) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const toggleCompareModel = (m: string) => {
    if (compareModels.includes(m)) {
      onCompareModelsChange(compareModels.filter((x) => x !== m));
    } else if (compareModels.length < 3) {
      onCompareModelsChange([...compareModels, m]);
    }
  };

  return (
    <FadeInUp delay={120}>
    <div className="border-t border-border bg-background/60 p-3">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="compare-mode" checked={compareMode} onCheckedChange={onCompareModeChange} />
            <Label htmlFor="compare-mode" className="text-sm">
              Mode perbandingan
            </Label>
          </div>

          {!compareMode ? (
            <Select value={model} onValueChange={(v) => v && onModelChange(v)}>
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

        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2 focus-within:border-ring/60">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanya apa saja... (Enter untuk kirim, Shift+Enter baris baru)"
            className="min-h-[44px] resize-none border-none bg-transparent p-1 shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button
            onClick={send}
            disabled={disabled || !text.trim()}
            size="icon"
            className="h-8 w-8 shrink-0 rounded-lg"
          >
            {text.trim() ? <ArrowUp className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {compareMode && compareModels.length < 2 && (
          <p className="mt-1 text-xs text-muted-foreground">Pilih 2-3 model untuk dibandingkan.</p>
        )}
      </div>
    </div>
    </FadeInUp>
  );
}