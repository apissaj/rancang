import { NextRequest, NextResponse } from "next/server";
import { requireUid } from "@/lib/sync-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { rateLimiter } from "@/lib/rate-limit";
import type { Conversation } from "@/lib/storage";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

const limiter = rateLimiter(30, 60_000);

export async function GET(req: NextRequest) {
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const snap = await getAdminDb().collection("users").doc(check.uid).collection("chats").get();
  const chats = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as Conversation);
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const limited = limiter.check(req);
  if (limited) return limited;
  const check = await requireUid(req);
  if ("error" in check) return check.error;
  const conversation = (await req.json()) as Conversation;
  if (!conversation?.id) {
    return NextResponse.json({ error: "Missing conversation.id" }, { status: 400 });
  }
  // Firestore document limit is 1MB — reject oversized payloads early.
  if (JSON.stringify(conversation).length > 900_000) {
    return NextResponse.json({ error: "Payload terlalu besar (maks ~900KB)" }, { status: 413 });
  }
  await getAdminDb()
    .collection("users")
    .doc(check.uid)
    .collection("chats")
    .doc(conversation.id)
    .set(conversation);
  return NextResponse.json({ ok: true });
}
