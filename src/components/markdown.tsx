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

// Places an inline caret right after the last text node in the streamed
// document, inside that text node's own parent. Appending it as the last child
// of the deepest element instead would put a <span> directly inside <table>,
// <ul>, or <ol> — invalid HTML that React reports as a hydration error and that
// also makes the caret jump to the wrong place while a list/table streams in.
function rehypeTypingCaret() {
  return (tree: HastNode) => {
    const caret: HastNode = {
      type: "element",
      tagName: "span",
      properties: { className: ["typing-caret"], ariaHidden: "true" },
      children: [],
    };
    let targetParent: HastNode | null = null;
    let targetIndex = -1;
    const visit = (node: HastNode) => {
      const kids = node.children;
      if (!kids) return;
      kids.forEach((child, i) => {
        if (child.type === "text") {
          if (child.value && child.value.trim() !== "") {
            targetParent = node;
            targetIndex = i;
          }
        } else if (child.type === "element") {
          visit(child);
        }
      });
    };
    visit(tree);
    if (targetParent && targetIndex >= 0) {
      (targetParent as HastNode).children!.splice(targetIndex + 1, 0, caret);
    } else {
      tree.children = [...(tree.children ?? []), caret];
    }
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
