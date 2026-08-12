import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Firebase Admin is optional: sync API routes return 503 if unset/invalid instead of crashing the app.
let initError: string | null = null;

function init() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    initError = "FIREBASE_SERVICE_ACCOUNT_JSON not set";
    return;
  }
  try {
    const serviceAccount = JSON.parse(raw);
    initializeApp({ credential: cert(serviceAccount) });
  } catch (err) {
    initError = `Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${err instanceof Error ? err.message : String(err)}`;
    console.warn("[firebase-admin]", initError);
  }
}

init();

export const adminEnabled = getApps().length > 0;
export const adminInitError = initError;

export function getAdminAuth() {
  return getAuth();
}

let dbConfigured = false;

export function getAdminDb() {
  const db = getFirestore();
  // NAS/tunnel network drops long-lived gRPC (HTTP/2) streams -> DEADLINE_EXCEEDED after 60s.
  // Force REST transport (plain HTTPS request/response) instead. Must be set before first use.
  if (!dbConfigured) {
    dbConfigured = true;
    db.settings({ preferRest: true, ignoreUndefinedProperties: true });
  }
  return db;
}

/**
 * Strips legacy base64 data-URL images (anything starting with "data:") from a design's screens
 * before writing to Firestore. Pre-v1.2.0 designs may still have multi-megabyte data-URLs cached
 * in generatedImage; Firestore's REST transport rejects documents with large strings nested in
 * arrays with an opaque "Property array contains an invalid nested entity" error, silently
 * breaking the whole sync (not just that field) — better to drop the stale field than fail the
 * write. New generations always produce small /api/images/... URL paths, unaffected by this.
 */
export function sanitizeDesignForFirestore<T extends { screens?: unknown[]; versions?: { screens?: unknown[] }[] }>(design: T): T {
  const stripDataUrls = (screens: unknown[] | undefined) =>
    screens?.map((s) => {
      const screen = s as { generatedImage?: string };
      if (typeof screen.generatedImage === "string" && screen.generatedImage.startsWith("data:")) {
        const { generatedImage: _drop, ...rest } = screen;
        return rest;
      }
      return screen;
    });
  return {
    ...design,
    screens: stripDataUrls(design.screens) ?? design.screens,
    versions: design.versions?.map((v) => ({ ...v, screens: stripDataUrls(v.screens) ?? v.screens })),
  };
}
