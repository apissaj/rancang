"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { firebaseEnabled } from "@/lib/firebase-client";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (loading || !firebaseEnabled || user || redirected) return;
    if (pathname === "/login") return;
    setRedirected(true);
    router.replace(`/login?next=${encodeURIComponent(pathname ?? "/")}`);
  }, [loading, user, redirected, pathname, router]);

  if (loading) return null;
  if (!firebaseEnabled) return <>{children}</>;
  if (!user) return null;
  return <>{children}</>;
}
