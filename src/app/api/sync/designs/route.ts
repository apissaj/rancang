import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb, sanitizeDesignForFirestore } from "@/lib/firebase-admin";
import { rateLimiter } from "@/lib/rate-limit";
import type { DesignRecord } from "@/lib/storage";

const limiter = rateLimiter(30, 60_000);

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("designs").get();
  const designs = snap.docs.map((d) => d.data() as DesignRecord);
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const design = (await req.json()) as DesignRecord;
  if (!design?.id) {
    return NextResponse.json({ error: "Missing design.id" }, { status: 400 });
  }
  // Firestore document limit is 1MB — reject oversized payloads early.
  if (JSON.stringify(design).length > 900_000) {
    return NextResponse.json({ error: "Payload terlalu besar (maks ~900KB)" }, { status: 413 });
  }
  await getAdminDb()
    .collection("users")
    .doc(check.uid)
    .collection("designs")
    .doc(design.id)
    .set(sanitizeDesignForFirestore(design));
  return NextResponse.json({ ok: true });
}
