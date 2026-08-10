import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const { id } = await params;
  await getAdminDb().collection("users").doc(check.uid).collection("designs").doc(id).delete();
  return NextResponse.json({ ok: true });
}
