"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { firebaseEnabled } from "@/lib/firebase-client";

export function AuthButton() {
  const { user, loading, signIn, signOut } = useAuth();

  if (!firebaseEnabled || loading) return null;

  if (!user) {
    return (
      <Button variant="outline" size="sm" onClick={signIn}>
        Sign in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt={user.displayName ?? "User"} className="h-6 w-6 rounded-full" />
      ) : (
        <UserIcon className="h-5 w-5" />
      )}
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName ?? user.email}</span>
      <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
