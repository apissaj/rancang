"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { nanoid } from "nanoid";
import { designStore, type DesignRecord, type DesignVersion, type Screen } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import type { useSync } from "@/lib/use-sync";

export function useDesignVersions({
  designMd,
  setDesignMd,
  screens,
  setScreens,
  activeDesign,
  setDesigns,
  sync,
  onPublish,
}: {
  designMd: string;
  setDesignMd: (v: string) => void;
  screens: Screen[];
  setScreens: (v: Screen[]) => void;
  activeDesign: DesignRecord | null;
  setDesigns: Dispatch<SetStateAction<DesignRecord[]>>;
  sync: ReturnType<typeof useSync>;
  onPublish: (record: DesignRecord) => Promise<void>;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);

  const versions = activeDesign?.versions ?? [];
  const viewedVersion = viewingVersionId ? versions.find((v) => v.id === viewingVersionId) ?? null : null;

  const persistNewVersion = (version: DesignVersion) => {
    if (!activeDesign) return;
    const updated: DesignRecord = {
      ...activeDesign,
      designMd: version.designMd,
      screens: version.screens,
      versions: [...activeDesign.versions, version],
    };
    designStore.save(updated);
    sync.syncDesign(updated);
    setDesigns(designStore.all());
    setDesignMd(updated.designMd);
    setScreens(updated.screens);
    setViewingVersionId(null);
    void onPublish(updated);
    return updated;
  };

  const startEdit = () => {
    setEditDraft(designMd);
    setEditing(true);
  };

  const saveEdit = () => {
    persistNewVersion({ id: nanoid(), designMd: editDraft, screens, createdAt: Date.now(), source: "manual-edit" });
    setEditing(false);
  };

  const runAiEdit = async () => {
    if (!activeDesign || !aiInstruction.trim() || aiEditing) return;
    setAiEditing(true);
    setError(null);
    const instruction = aiInstruction;
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/design/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ designMd, screens, instruction }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Edit gagal" }))).error ?? "Edit gagal");
      const data = (await res.json()) as { designMd: string; screens: Screen[] };
      persistNewVersion({ id: nanoid(), designMd: data.designMd, screens: data.screens, createdAt: Date.now(), source: "ai-edit", note: instruction });
      setAiInstruction("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setAiEditing(false);
    }
  };

  const restoreVersion = () => {
    if (!viewedVersion) return;
    const idx = versions.findIndex((v) => v.id === viewedVersion.id) + 1;
    const isLatest = idx === versions.length;
    if (!isLatest && !window.confirm(`Pulihkan versi v${idx}? Versi saat ini akan disimpan sebagai riwayat (tidak hilang).`)) return;
    persistNewVersion({
      id: nanoid(),
      designMd: viewedVersion.designMd,
      screens: viewedVersion.screens,
      createdAt: Date.now(),
      source: "manual-edit",
      note: `Restored from v${idx}`,
    });
  };

  return {
    versions,
    viewedVersion,
    editing,
    setEditing,
    editDraft,
    setEditDraft,
    aiInstruction,
    setAiInstruction,
    aiEditing,
    error,
    viewingVersionId,
    setViewingVersionId,
    persistNewVersion,
    startEdit,
    saveEdit,
    runAiEdit,
    restoreVersion,
  };
}
