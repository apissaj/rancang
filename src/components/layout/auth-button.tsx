"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { firebaseEnabled } from "@/lib/firebase-client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export function AuthButton() {
  const { user, loading, signIn, signOut } = useAuth();
  const router = useRouter();

  if (!firebaseEnabled || loading) return null;

  if (!user) {
    return (
      <Button size="sm" onClick={signIn} className="ml-1 gap-2 font-medium shadow-sm">
        <GoogleIcon />
        Masuk dengan Google
      </Button>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    <div className="ml-1 flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt={user.displayName ?? "User"} className="h-6 w-6 rounded-full" />
      ) : (
        <UserIcon className="h-5 w-5" />
      )}
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.displayName ?? user.email}</span>
      <Button variant="ghost" size="icon-sm" onClick={handleSignOut} aria-label="Keluar">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
