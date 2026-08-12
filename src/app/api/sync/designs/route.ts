import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb, sanitizeDesignForFirestore } from "@/lib/firebase-admin";
import type { DesignRecord } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("designs").get();
  const designs = snap.docs.map((d) => d.data() as DesignRecord);
  return NextResponse.json({ designs });
}

export async function POST(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const design = (await req.json()) as DesignRecord;
  if (!design?.id) {
    return NextResponse.json({ error: "Missing design.id" }, { status: 400 });
  }
  await getAdminDb()
    .collection("users")
    .doc(check.uid)
    .collection("designs")
    .doc(design.id)
    .set(sanitizeDesignForFirestore(design));
  return NextResponse.json({ ok: true });
}
