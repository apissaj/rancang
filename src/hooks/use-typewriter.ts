import { useEffect, useRef, useState } from "react";
import { PREVIEW_DOCS } from "@/components/plan/preview-window";
import type { DocStatus } from "@/hooks/use-plan-stream";

const TYPE_TICK_MS = 16;
const TYPE_CHARS_PER_TICK = 4;

export function useTypewriter({
  active,
  docs,
  docStatus,
}: {
  active: boolean;
  docs: Record<string, string>;
  docStatus: Record<string, DocStatus>;
}) {
  const [typeCursor, setTypeCursor] = useState({ idx: 0, shown: 0 });
  const [typingActive, setTypingActive] = useState(false);
  const typing = (active || typingActive) && typeCursor.idx < PREVIEW_DOCS.length;
  const typeCursorRef = useRef(typeCursor);
  const docsRef = useRef(docs);
  const docStatusRef = useRef(docStatus);
  docsRef.current = docs;
  docStatusRef.current = docStatus;
  typeCursorRef.current = typeCursor;
  useEffect(() => {
    if (typeCursor.idx >= PREVIEW_DOCS.length) setTypingActive(false);
  }, [typeCursor.idx]);
  useEffect(() => {
    if (!typing) return;
    const id = setInterval(() => {
      const prev = typeCursorRef.current;
      if (prev.idx >= PREVIEW_DOCS.length) return;
      const doc = PREVIEW_DOCS[prev.idx];
      const available = docsRef.current[doc]?.length ?? 0;
      if (prev.shown < available) {
        setTypeCursor({ idx: prev.idx, shown: Math.min(available, prev.shown + TYPE_CHARS_PER_TICK) });
      } else if (docStatusRef.current[doc] === "done") {
        setTypeCursor({ idx: prev.idx + 1, shown: 0 });
      }
    }, TYPE_TICK_MS);
    return () => clearInterval(id);
  }, [typing]);
  const resetTypeCursor = () => setTypeCursor({ idx: 0, shown: 0 });
  return { typeCursor, typingActive, setTypingActive, resetTypeCursor, typing };
}
