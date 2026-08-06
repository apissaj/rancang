import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { adminEnabled, adminInitError, getAdminAuth } from "@/lib/firebase-admin";

/** Verifies the Authorization: Bearer <idToken> header. Returns uid or a ready-to-send error response. */
export async function requireUid(
  req: NextRequest
): Promise<{ uid: string } | { error: NextResponse }> {
  if (!adminEnabled) {
    return {
      error: NextResponse.json(
        { error: `Sync unavailable: ${adminInitError ?? "Firebase Admin not configured"}` },
        { status: 503 }
      ),
    };
  }
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { error: NextResponse.json({ error: "Missing Authorization header" }, { status: 401 }) };
  }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return { error: NextResponse.json({ error: "Invalid or expired token" }, { status: 401 }) };
  }
}
