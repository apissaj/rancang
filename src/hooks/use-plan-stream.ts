import type { Dispatch, MutableRefObject, SetStateAction } from "react";

export type DocStatus = "pending" | "writing" | "done";

export type Answer = { question: string; selected: string[]; note?: string };

export function usePlanStream({
  setDocs,
  setDocStatus,
  manualDocRef,
  partialRef,
  getSignal,
}: {
  setDocs: Dispatch<SetStateAction<Record<string, string>>>;
  setDocStatus: Dispatch<SetStateAction<Record<string, DocStatus>>>;
  manualDocRef: MutableRefObject<boolean>;
  partialRef: MutableRefObject<{ markdown: string; docs: Record<string, string> }>;
  getSignal: () => AbortSignal | undefined;
}) {
  const streamMultiDocs = async (ideaText: string, selectedModel: string, answers: Answer[] | undefined) => {
    const res = await fetch("/api/plan/full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: getSignal(),
      body: JSON.stringify({ idea: ideaText, answers, model: selectedModel }),
    });
    if (!res.ok || !res.body) throw new Error(await res.text());
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // Docs can interleave on the server, so routing follows the open set: the
    // next bytes belong to the most recently opened doc that has not closed yet.
    const openOrder: string[] = [];
    let currentDoc = "prd";
    const collected: Record<string, string> = { prd: "", spec: "", plan: "", tasks: "" };
    const DOC_MARKER = /<!-- (\/)?DOC:(\w+) -->/g;
    // Max length of a `<!-- DOC:xxxx -->` marker. We only need to hold this
    // many trailing characters in the buffer to guard against a marker being
    // split across chunk boundaries.
    const DOC_MARKER_LEN = 32;
    manualDocRef.current = false;
    setDocStatus({ prd: "pending", spec: "pending", plan: "pending", tasks: "pending" });
    const markWriting = (d: string) => {
      setDocStatus((prev) => ({ ...prev, [d]: "writing" }));
    };
    // Emit content from `s` into `collected`, splitting on markers. Returns the
    // text AFTER the last marker (may contain a marker split across chunks).
    const processBuffer = (s: string): string => {
      DOC_MARKER.lastIndex = 0;
      let pos = 0;
      let m: RegExpExecArray | null;
      while ((m = DOC_MARKER.exec(s)) !== null) {
        const before = s.slice(pos, m.index);
        if (before) collected[currentDoc] += before;
        const closing = m[1] === "/";
        const name = m[2];
        if (closing) {
          if (name in collected) {
            const idx = openOrder.lastIndexOf(name);
            if (idx !== -1) openOrder.splice(idx, 1);
            currentDoc = openOrder.length > 0 ? openOrder[openOrder.length - 1] : currentDoc;
            setDocStatus((prev) => ({ ...prev, [name]: "done" }));
          }
        } else if (name in collected) {
          openOrder.push(name);
          currentDoc = name;
          markWriting(name);
        }
        pos = m.index + m[0].length;
      }
      return s.slice(pos);
    };
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Process markers in the buffer, flushing everything before the last
      // marker into `collected[currentDoc]`.
      buffer = processBuffer(buffer);
      // Keep only the last DOC_MARKER_LEN chars so a marker split across two
      // chunks is not lost; flush the rest into the active doc so the preview
      // streams live instead of appearing all at once at the end.
      if (buffer.length > DOC_MARKER_LEN) {
        const safe = buffer.slice(0, -DOC_MARKER_LEN);
        collected[currentDoc] += safe;
        buffer = buffer.slice(-DOC_MARKER_LEN);
      }
      setDocs({ ...collected });
      partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    }
    // Flush whatever remains (trailing content after the last marker, or a doc
    // whose marker never arrived).
    // First re-scan the tail for markers that were held back across chunks.
    buffer = processBuffer(buffer);
    if (buffer.trim()) collected[currentDoc] += buffer;
    setDocs({ ...collected });
    setDocStatus({ prd: "done", spec: "done", plan: "done", tasks: "done" });
    partialRef.current = { markdown: collected.prd, docs: { ...collected } };
    return collected;
  };

  return { streamMultiDocs };
}
