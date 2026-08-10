import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export function imageStorageDir(): string {
  return process.env.IMAGE_STORAGE_DIR || "/app/data/images";
}

// Rejects anything that could escape the per-design directory.
export function isSafeSegment(segment: string): boolean {
  return !!segment && !segment.includes("..") && !segment.includes("/") && !segment.includes("\\");
}

function pngPath(designId: string, screenId: string): string {
  return path.join(imageStorageDir(), designId, `${screenId}.png`);
}

/** Decodes a base64 PNG (data-URL or raw) and writes it to disk. Returns the public URL path. */
export async function saveImage(designId: string, screenId: string, dataUrlOrB64: string): Promise<string> {
  if (!isSafeSegment(designId) || !isSafeSegment(screenId)) {
    throw new Error("Invalid designId or screenId");
  }
  const b64 = dataUrlOrB64.startsWith("data:") ? dataUrlOrB64.split(",", 2)[1] ?? "" : dataUrlOrB64;
  const buf = Buffer.from(b64, "base64");
  const filePath = pngPath(designId, screenId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buf);
  return `/api/images/${designId}/${screenId}.png`;
}

export async function readImage(designId: string, screenId: string): Promise<Buffer | null> {
  if (!isSafeSegment(designId) || !isSafeSegment(screenId)) return null;
  try {
    return await readFile(pngPath(designId, screenId));
  } catch {
    return null;
  }
}
