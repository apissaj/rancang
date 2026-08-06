"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { firebaseEnabled } from "@/lib/firebase-client";

/** Wrap a page's content with this to require a signed-in user before rendering it. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signIn } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sign in to continue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {firebaseEnabled
                ? "This page is available to signed-in users only."
                : "Sign-in isn't configured for this deployment."}
            </p>
          </div>
          {firebaseEnabled && (
            <Button onClick={signIn} className="w-full">
              Sign in with Google
            </Button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
