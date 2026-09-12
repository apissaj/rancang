import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimiter } from "@/lib/rate-limit";
import type { PlanRecord } from "@/lib/storage";

const limiter = rateLimiter(30, 60_000);

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("plans").get();
  const plans = snap.docs.map((d) => d.data() as PlanRecord);
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const plan = (await req.json()) as PlanRecord;
  if (!plan?.id) {
    return NextResponse.json({ error: "Missing plan.id" }, { status: 400 });
  }
  // Firestore document limit is 1MB — reject oversized payloads early.
  if (JSON.stringify(plan).length > 900_000) {
    return NextResponse.json({ error: "Payload terlalu besar (maks ~900KB)" }, { status: 413 });
  }
  await getAdminDb().collection("users").doc(check.uid).collection("plans").doc(plan.id).set(plan);
  return NextResponse.json({ ok: true });
}
