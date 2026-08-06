"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase is optional: if config is incomplete, auth/sync stay disabled and app runs anonymous-only.
export const firebaseEnabled = Object.values(config).every(Boolean);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

if (firebaseEnabled) {
  app = getApps().length ? getApps()[0] : initializeApp(config);
  auth = getAuth(app);
}

export { app, auth };
