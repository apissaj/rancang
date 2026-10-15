"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { designStore, type DesignRecord, type Screen } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import type { useSync } from "@/lib/use-sync";

export function useDesignImages({
  screens,
  setScreens,
  designMd,
  activeDesign,
  setDesigns,
  sync,
}: {
  screens: Screen[];
  setScreens: (v: Screen[]) => void;
  designMd: string;
  activeDesign: DesignRecord | null;
  setDesigns: Dispatch<SetStateAction<DesignRecord[]>>;
  sync: ReturnType<typeof useSync>;
}) {
  const { user } = useAuth();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [genStartedAt, setGenStartedAt] = useState<number | null>(null);
  const [genJustSucceeded, setGenJustSucceeded] = useState(false);

  // Ref mirrors the latest `screens` so sequential calls within the same bulk-generate loop
  // (generateAllForTab awaits generateImage in a for-loop) don't each build off a stale closure
  // of `screens` captured at render time — without this, each finished image overwrote the
  // previous one's result back to "ungenerated" because setScreens is async and the loop body
  // doesn't wait for a re-render between iterations.
  const screensRef = useRef(screens);
  screensRef.current = screens;

  // Same reason as screensRef: a version added mid-bulk-run (e.g. "Revise" while images generate)
  // would otherwise be clobbered by the stale `activeDesign` closure on the next persist.
  const activeDesignRef = useRef(activeDesign);
  activeDesignRef.current = activeDesign;

  const persistScreenImage = (screenId: string, image: string) => {
    const updatedScreens = screensRef.current.map((s) => (s.id === screenId ? { ...s, generatedImage: image } : s));
    screensRef.current = updatedScreens;
    setScreens(updatedScreens);
    const design = activeDesignRef.current;
    if (!design) return;
    const lastIdx = design.versions.length - 1;
    const updatedVersions = design.versions.map((v, i) => (i === lastIdx ? { ...v, screens: updatedScreens } : v));
    const updated: DesignRecord = { ...design, screens: updatedScreens, versions: updatedVersions };
    designStore.save(updated);
    sync.syncDesign(updated);
    setDesigns(designStore.all());
  };

  const generateImage = async (screenId: string, attempt = 1): Promise<void> => {
    const target = screensRef.current.find((s) => s.id === screenId);
    if (!target) return;
    setGeneratingId(screenId);
    setImageError(null);
    setGenStartedAt(Date.now());
    try {
      const token = user ? await user.getIdToken() : null;
      const res = await fetch("/api/design/image", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ screen: target, designMd, designId: activeDesign?.id }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "Pembuatan gambar gagal" }))).error ?? "Pembuatan gambar gagal");
      const data = (await res.json()) as { imageUrl: string };
      setGenJustSucceeded(true);
      await new Promise((r) => setTimeout(r, 250));
      persistScreenImage(screenId, data.imageUrl);
    } catch (err) {
      // "Failed to fetch" / TypeError = network drop (common on mobile: tab backgrounded mid-request
      // during the 60-120s generation, or a flaky connection). Retry once automatically before
      // surfacing an error, since the image-gen call itself is idempotent (just re-renders the prompt).
      const isNetworkError = err instanceof TypeError;
      if (isNetworkError && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        return generateImage(screenId, attempt + 1);
      }
      setImageError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setGeneratingId(null);
      setGenStartedAt(null);
      setGenJustSucceeded(false);
    }
  };

  const generateAllForTab = async (tabScreens: Screen[]) => {
    const pending = tabScreens.filter((s) => !s.generatedImage);
    if (pending.length === 0) return;
    setBulkProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      await generateImage(pending[i].id);
      setBulkProgress({ done: i + 1, total: pending.length });
    }
    setBulkProgress(null);
  };

  return {
    generatingId,
    imageError,
    bulkProgress,
    genStartedAt,
    genJustSucceeded,
    generateImage,
    generateAllForTab,
  };
}
