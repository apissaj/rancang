import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import type { PlanRecord } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("plans").get();
  const plans = snap.docs.map((d) => d.data() as PlanRecord);
  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const plan = (await req.json()) as PlanRecord;
  if (!plan?.id) {
    return NextResponse.json({ error: "Missing plan.id" }, { status: 400 });
  }
  await getAdminDb().collection("users").doc(check.uid).collection("plans").doc(plan.id).set(plan);
  return NextResponse.json({ ok: true });
}
