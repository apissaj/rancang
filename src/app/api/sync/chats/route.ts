import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import type { Conversation } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("chats").get();
  const chats = snap.docs.map((d) => d.data() as Conversation);
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const conversation = (await req.json()) as Conversation;
  if (!conversation?.id) {
    return NextResponse.json({ error: "Missing conversation.id" }, { status: 400 });
  }
  await getAdminDb()
    .collection("users")
    .doc(check.uid)
    .collection("chats")
    .doc(conversation.id)
    .set(conversation);
  return NextResponse.json({ ok: true });
}
