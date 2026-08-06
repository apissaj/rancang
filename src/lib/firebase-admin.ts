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

export function getAdminDb() {
  return getFirestore();
}
