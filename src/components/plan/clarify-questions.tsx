"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import type { ClarifyResponse } from "@/lib/clarify-types";

export type QuestionAnswers = Record<string, { selected: string[]; note?: string }>;

export function ClarifyQuestions({
  clarify,
  onSubmit,
  onSkip,
  submitting,
}: {
  clarify: ClarifyResponse;
  onSubmit: (answers: QuestionAnswers) => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<QuestionAnswers>({});

  const setSelected = (qid: string, selected: string[]) => {
    setAnswers((prev) => ({ ...prev, [qid]: { selected, note: prev[qid]?.note } }));
  };

  const setNote = (qid: string, note: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: { selected: prev[qid]?.selected ?? [], note } }));
  };

  const allAnswered = clarify.questions.every((q) => (answers[q.id]?.selected.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-3">
      {clarify.intro && <p className="text-sm text-muted-foreground">{clarify.intro}</p>}

      {clarify.questions.map((q) => {
        const selected = answers[q.id]?.selected ?? [];
        const noteVisible = q.options.some((o) => o.allowsNote && selected.includes(o.id));

        return (
          <Card key={q.id} size="sm" className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">{q.question}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {q.type === "single" ? (
                <RadioGroup
                  value={selected[0] ?? undefined}
                  onValueChange={(value) => setSelected(q.id, [String(value)])}
                  className="gap-2"
                >
                  {q.options.map((o) => (
                    <Label key={o.id} className="cursor-pointer gap-2 font-normal">
                      <RadioGroupItem value={o.id} />
                      {o.label}
                    </Label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="flex flex-col gap-2">
                  {q.options.map((o) => {
                    const checked = selected.includes(o.id);
                    return (
                      <Label key={o.id} className="cursor-pointer gap-2 font-normal">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setSelected(
                              q.id,
                              v ? [...selected, o.id] : selected.filter((s) => s !== o.id)
                            )
                          }
                        />
                        {o.label}
                      </Label>
                    );
                  })}
                </div>
              )}
              {noteVisible && (
                <Input
                  placeholder="Add a detail..."
                  value={answers[q.id]?.note ?? ""}
                  onChange={(e) => setNote(q.id, e.target.value)}
                  className="mt-1"
                />
              )}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex items-center gap-3 pt-1">
        <Button onClick={() => onSubmit(answers)} disabled={!allAnswered || submitting}>
          {submitting ? "Generating..." : "Generate PRD"}
        </Button>
        <Button variant="link" size="sm" onClick={onSkip} disabled={submitting}>
          Skip questions, generate directly
        </Button>
      </div>
    </div>
  );
}
