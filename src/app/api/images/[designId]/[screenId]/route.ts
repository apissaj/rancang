import { NextRequest, NextResponse } from "next/server";
import { readImage } from "@/lib/image-storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ designId: string; screenId: string }> }) {
  const { designId, screenId } = await params;
  const screenIdNoExt = screenId.replace(/\.png$/i, "");
  const buf = await readImage(designId, screenIdNoExt);
  if (!buf) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
