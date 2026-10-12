"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Splits YAML front matter (--- ... ---) from the Markdown body so front matter
// renders as a clean monospace code block instead of a giant merged paragraph.
function splitFrontMatter(content: string): { front: string | null; body: string } {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { front: null, body: content };
  const endIdx = lines.slice(1).findIndex((l) => l.trim() === "---");
  if (endIdx === -1) return { front: null, body: content };
  const front = lines.slice(1, endIdx + 1).join("\n");
  const body = lines.slice(endIdx + 2).join("\n");
  return { front, body };
}

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

// Places an inline caret at the very end of the streamed text (inside the last
// text-bearing element) instead of after the whole block, so it follows typing.
function rehypeTypingCaret() {
  return (tree: HastNode) => {
    let parent = tree;
    for (;;) {
      const last = parent.children?.[parent.children.length - 1];
      if (!last || last.type !== "element") break;
      if (!last.children?.length) break;
      parent = last;
    }
    const caret: HastNode = {
      type: "element",
      tagName: "span",
      properties: { className: ["typing-caret"], ariaHidden: "true" },
      children: [],
    };
    parent.children = [...(parent.children ?? []), caret];
  };
}

export function Markdown({ content, cursor = false }: { content: string; cursor?: boolean }) {
  const { front, body } = splitFrontMatter(content);
  const rehypePlugins = cursor ? [rehypeHighlight, rehypeTypingCaret] : [rehypeHighlight];

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-muted prose-pre:text-foreground">
      {front && (
        <pre className="mb-4 overflow-x-auto rounded-lg border bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground">
          {front}
        </pre>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
