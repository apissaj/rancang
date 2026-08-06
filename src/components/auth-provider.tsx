"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, firebaseEnabled } from "@/lib/firebase-client";
import { setStorageScope } from "@/lib/storage";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Bumps whenever the storage scope (anon <-> uid) switches, so consumers can re-read localStorage. */
  storageVersion: number;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  signIn: async () => {},
  signOut: async () => {},
  storageVersion: 0,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [storageVersion, setStorageVersion] = useState<number>(0);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      // Firebase disabled entirely: always anonymous scope, nothing to switch.
      setStorageScope(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      // Switch the localStorage namespace the moment identity changes, BEFORE
      // any component re-reads chats/plans, so anon and per-user data never mix.
      setStorageScope(u ? u.uid : null);
      setUser(u);
      setLoading(false);
      setStorageVersion((v) => v + 1);
    });
    return unsub;
  }, []);

  const signIn = async () => {
    if (!firebaseEnabled || !auth) return;
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const signOut = async () => {
    if (!firebaseEnabled || !auth) return;
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, storageVersion }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
