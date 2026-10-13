import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { planStore, type PlanRecord } from "@/lib/storage";

export function useMcpPublish({
  getDocs,
  modelRef,
  setError,
}: {
  getDocs: () => Record<string, string>;
  modelRef: { readonly current: string };
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  const [mcpBlueprintId, setMcpBlueprintId] = useState<string | null>(null);
  const [mcpCopied, setMcpCopied] = useState(false);
  // Maps a local plan id -> the blueprint id the MCP bridge assigned, so
  // re-publishing after an edit updates the same blueprint instead of cloning.
  const mcpIds = useRef<Record<string, string>>({});

  // Push a finished blueprint to the MCP bridge so coding agents (Claude Code,
  // Cursor, Codex, Hermes) can pull it via the rancang_* MCP tools. Runs in the
  // background: local generation must never fail because the bridge is down.
  const publishMCP = async (record: PlanRecord, opts?: { silent?: boolean }) => {
    if (!record.docs || Object.keys(record.docs).length === 0) return;
    try {
      const res = await fetch("/api/mcp/blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: mcpIds.current[record.id],
          title: record.title,
          idea: record.idea,
          model: modelRef.current,
          docs: record.docs,
        }),
      });
      if (!res.ok) {
        if (!opts?.silent || res.status === 413) {
          const detail = await res.json().then((j: { error?: string }) => j.error).catch(() => undefined);
          setError(
            res.status === 413
              ? `Blueprint tersimpan lokal, tapi terlalu besar untuk dikirim ke MCP bridge${detail ? ` (${detail})` : ""}. Kurangi ukuran dokumen agar bisa dipakai agent.`
              : "Blueprint tersimpan lokal, tapi gagal dikirim ke MCP bridge."
          );
        }
        return;
      }
      const data = (await res.json()) as { id: string };
      mcpIds.current[record.id] = data.id;
      setMcpBlueprintId(data.id);
      // Persist the bridge-assigned id on the record so a page reload or plan
      // switch can restore the "Salin Prompt MCP" button without re-publishing.
      if (data.id !== record.mcpId) {
        const stored = planStore.all().find((p) => p.id === record.id);
        if (stored) planStore.save({ ...stored, mcpId: data.id });
      }
      if (!opts?.silent) setMcpCopied(true);
    } catch {
      if (!opts?.silent) setError("Blueprint tersimpan lokal, tapi MCP bridge tidak jalan (port 3110?).");
    }
  };

  const copyMcpPrompt = async () => {
    if (!mcpBlueprintId) return;
    const hasDesign = !!getDocs().design?.trim();
    const mcpDocTail = hasDesign
      ? `Blueprint ini berisi PRD, spec, plan, tasks, dan DESIGN.md + wireframe — ikuti semuanya, ` +
        `terutama DESIGN.md untuk implementasi UI/UX.`
      : `Blueprint ini berisi PRD, spec, plan, tasks. ` +
        `(DESIGN.md akan menyusul jika kamu membuat desain dari PRD ini.) ` +
        `Ikuti blueprint ini saat mengimplementasi, sesuai urutan tugas.`;
    try {
      await navigator.clipboard.writeText(
        `Gunakan MCP server "rancang". Blueprint id: ${mcpBlueprintId}. ` +
          `Panggil rancang_execution_prompt dengan id "${mcpBlueprintId}" (jangan pakai "latest"), ` +
          `lalu kerjakan task-nya satu per satu: rancang_next_task dengan id "${mcpBlueprintId}" → ` +
          `implementasi + verifikasi → rancang_task_complete dengan id "${mcpBlueprintId}". ` +
          `Kerjakan di folder proyek yang sedang aktif. ` +
          mcpDocTail
      );
      setMcpCopied(true);
      setTimeout(() => setMcpCopied(false), 1500);
    } catch {
      setError("Gagal menyalin prompt MCP.");
    }
  };

  return {
    publishMCP,
    copyMcpPrompt,
    mcpBlueprintId,
    setMcpBlueprintId,
    mcpCopied,
    setMcpCopied,
    mcpIds,
  };
}
