"use client";

import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planLabel } from "@/lib/design-export";
import type { Platform } from "@/lib/design-doc";

export function SetupForm({
  idea,
  setIdea,
  sourcePlanId,
  setSourcePlanId,
  plans,
  vibe,
  setVibe,
  platform,
  setPlatform,
  pwa,
  setPwa,
  loading,
  error,
  onGenerate,
  hasResult,
  onBackToResult,
}: {
  idea: string;
  setIdea: (v: string) => void;
  sourcePlanId: string;
  setSourcePlanId: (v: string) => void;
  plans: { id: string; title: string; idea?: string; markdown: string }[];
  vibe: string;
  setVibe: (v: string) => void;
  platform: Platform;
  setPlatform: (v: Platform) => void;
  pwa: boolean;
  setPwa: (v: boolean) => void;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  hasResult: boolean;
  onBackToResult: () => void;
}) {
  // Base UI's <SelectValue> resolves the trigger label from the Root's `items` prop — NOT from
  // the rendered <SelectItem> children. Without `items` it stringifies the raw value, which is
  // why the trigger showed a bare nanoid. planLabel() also guards against a blank title.
  const planItems = [
    { value: "none", label: "None (write idea manually)" },
    ...plans.map((p) => ({ value: p.id, label: planLabel(p) })),
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:p-6">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {hasResult && (
          <Button variant="ghost" size="sm" className="w-fit" onClick={onBackToResult}>
            <ChevronLeft className="h-4 w-4" /> Back to prototype
          </Button>
        )}
        <div>
          <h1 className="text-xl font-semibold">Ubah ide jadi desain</h1>
          <p className="text-sm text-muted-foreground">
            Menghasilkan spesifikasi token DESIGN.md plus prototipe wireframe yang bisa diklik.
          </p>
        </div>

        {plans.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Mulai dari PRD yang ada (opsional)</Label>
            <Select
              value={sourcePlanId}
              onValueChange={(v) => {
                if (!v) return;
                setSourcePlanId(v);
                if (v !== "none") {
                  const targetPlan = plans.find((p) => p.id === v);
                  if (targetPlan && !idea.trim()) {
                    setIdea(targetPlan.idea || targetPlan.title);
                  }
                }
              }}
              items={planItems}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Idea</Label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder='mis. "Aplikasi pelacak kebiasaan di mana pengguna mencatat kebiasaan harian dan melihat streak"'
            className="min-h-[120px] resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Vibe (opsional)</Label>
          <Input
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="e.g. playful, pastel — or corporate, dark, minimal"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Platform</Label>
          <RadioGroup value={platform} onValueChange={(v) => v && setPlatform(v as Platform)} className="flex gap-4">
            {(["mobile", "web", "both"] as const).map((p) => (
              <label key={p} className="flex cursor-pointer items-center gap-2 text-sm capitalize">
                <RadioGroupItem value={p} /> {p}
              </label>
            ))}
          </RadioGroup>
        </div>

        {platform !== "web" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={pwa} onCheckedChange={(v) => setPwa(!!v)} />
            Progressive Web App (installable)
          </label>
        )}

        <Button onClick={onGenerate} disabled={loading || !idea.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Membuat desain..." : "Buat Desain"}
        </Button>
        {loading && <p className="text-xs text-muted-foreground">Ini bisa butuh 10-30 detik.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
