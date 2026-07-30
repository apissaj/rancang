"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/markdown";
import { PlanSidebar } from "@/components/plan/plan-sidebar";
import { planStore, type PlanRecord } from "@/lib/storage";

const EXAMPLES = [
  "A habit tracker app where users log daily habits and see streaks",
  "A Chrome extension that summarizes long articles into 3 bullet points",
  "An internal tool for support agents to search and reply to tickets faster",
];

export default function PlanPage() {
  const [idea, setIdea] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlans(planStore.all());
  }, []);

  const generate = async () => {
    if (!idea.trim() || loading) return;
    setLoading(true);
    setError(null);
    setMarkdown("");
    setActiveId(null);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMarkdown(full);
      }

      const record: PlanRecord = {
        id: nanoid(),
        title: idea.slice(0, 60),
        idea,
        markdown: full,
        createdAt: Date.now(),
      };
      planStore.save(record);
      setPlans(planStore.all());
      setActiveId(record.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const loadPlan = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    setActiveId(id);
    setIdea(plan.idea);
    setMarkdown(plan.markdown);
    setError(null);
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prd.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      <PlanSidebar plans={plans} activeId={activeId} onSelect={loadPlan} />

      <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row lg:overflow-hidden lg:p-6">
        <div className="flex flex-col gap-3 lg:w-1/3">
          <div>
            <h1 className="text-xl font-semibold">Describe your idea</h1>
            <p className="text-sm text-muted-foreground">
              Get a structured PRD with goals, requirements, and a step-by-step task breakdown.
            </p>
          </div>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={`e.g. "${EXAMPLES[0]}"\n\nOther ideas:\n- ${EXAMPLES[1]}\n- ${EXAMPLES[2]}`}
            className="min-h-[200px] resize-none"
          />
          <Button onClick={generate} disabled={loading || !idea.trim()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Generating..." : "Generate PRD"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border lg:w-2/3">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">Preview</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyMarkdown} disabled={!markdown}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Markdown
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMarkdown} disabled={!markdown}>
                <Download className="h-3.5 w-3.5" />
                Download .md
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {markdown ? (
              <Markdown content={markdown} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your generated PRD will stream in here live.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
