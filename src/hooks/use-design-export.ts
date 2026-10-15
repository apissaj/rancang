"use client";

import { useState } from "react";
import type { DesignRecord, Screen } from "@/lib/storage";
import { buildHifiReadme, buildWireframeExport, screenFileName } from "@/lib/design-export";
import type { Platform } from "@/lib/design-doc";

export function useDesignExport({
  idea,
  platform,
  pwa,
  designMd,
  screens,
  activeDesign,
}: {
  idea: string;
  platform: Platform;
  pwa: boolean;
  designMd: string;
  screens: Screen[];
  activeDesign: DesignRecord | null;
}) {
  const [exportingZip, setExportingZip] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMarkdown = () => download(new Blob([designMd], { type: "text/markdown" }), "design.md");

  const exportWireframe = () => {
    const payload = buildWireframeExport({ design: activeDesign, idea, platform, pwa, designMd, screens });
    download(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), "wireframe.json");
  };

  const withImages = screens.filter((s) => s.generatedImage);

  const exportHifi = async () => {
    if (withImages.length === 0 || exportingZip) return;
    setExportingZip(true);
    setExportError(null);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const title = activeDesign?.title || idea.slice(0, 60) || "Untitled design";
      const entries: { name: string; file: string }[] = [];

      for (let i = 0; i < withImages.length; i++) {
        const screen = withImages[i];
        const res = await fetch(screen.generatedImage!);
        if (!res.ok) throw new Error(`Couldn't fetch the mockup for "${screen.name}"`);
        const file = screenFileName(screen, i);
        zip.file(`screens/${file}`, await res.blob());
        entries.push({ name: screen.name, file });
      }

      zip.file("DESIGN.md", designMd);
      zip.file("README.md", buildHifiReadme(title, designMd, entries));
      zip.file("wireframe.json", JSON.stringify(buildWireframeExport({ design: activeDesign, idea, platform, pwa, designMd, screens }), null, 2));
      download(await zip.generateAsync({ type: "blob" }), "hifi-assets.zip");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export gagal");
    } finally {
      setExportingZip(false);
    }
  };

  return {
    exportingZip,
    exportError,
    withImages,
    downloadMarkdown,
    exportWireframe,
    exportHifi,
  };
}
