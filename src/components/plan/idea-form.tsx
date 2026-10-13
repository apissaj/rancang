"use client";

import { Bookmark, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClarifyQuestions, type QuestionAnswers } from "@/components/plan/clarify-questions";
import { TEMPLATES } from "@/components/plan/idea-templates";
import type { PlanRecord } from "@/lib/storage";
import type { ClarifyResponse } from "@/lib/clarify-types";

export type IdeaFormProps = {
  idea: string;
  setIdea: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  models: string[];
  modelError: boolean;
  clarify: ClarifyResponse | null;
  clarifying: boolean;
  loading: boolean;
  activePlan: PlanRecord | null;
  error: string | null;
  notice: string | null;
  startGenerate: () => void;
  cancelGenerate: () => void;
  clarifyElapsed: number;
  submitAnswers: (answers: QuestionAnswers) => void;
  skipClarify: () => void;
};

export function IdeaForm({
  idea,
  setIdea,
  model,
  setModel,
  models,
  modelError,
  clarify,
  clarifying,
  loading,
  activePlan,
  error,
  notice,
  startGenerate,
  cancelGenerate,
  clarifyElapsed,
  submitAnswers,
  skipClarify,
}: IdeaFormProps) {
  return (
    <>
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
                    {t.idea.slice(0, 70)}{t.idea.length > 70 ? "..." : ""}
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
          {clarifying
            ? `Menganalisis ide kamu... (${clarifyElapsed}s)`
            : loading
              ? "Membuat..."
              : "Buat PRD"}
        </Button>
      )}
      {clarifying && clarifyElapsed >= 12 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground">
            Masih menganalisis. Kamu bisa lewati klarifikasi dan langsung membuat PRD.
          </span>
          <Button
            variant="link"
            size="sm"
            onClick={skipClarify}
            className="h-auto min-w-0 whitespace-normal p-0 text-left"
          >
            Lewati, langsung buat
          </Button>
        </div>
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
    </>
  );
}
