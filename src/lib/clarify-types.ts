export type ClarifyResponse = {
  intro: string;
  questions: Array<{
    id: string;
    question: string;
    type: "single" | "multi";
    options: Array<{ id: string; label: string; allowsNote?: boolean }>;
  }>;
};
