"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmailPasswordForm } from "@/components/auth/email-password-form";
import { useAuth } from "@/components/auth-provider";
import { firebaseEnabled } from "@/lib/firebase-client";
import { cn } from "@/lib/utils";

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

/** Only same-origin paths: rejects absolute, protocol-relative (`//`, `/\`),
 * and non-http schemes. Prevents post-login open redirect via `?next=`. */
function safeNext(raw: string | null): string {
  const v = (raw ?? "").trim();
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/plan";
}

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, signIn } = useAuth();
  const [tabs, setTabs] = useState<"signin" | "signup">("signin");

  const next = safeNext(searchParams.get("next"));

  useEffect(() => {
    if (user && !loading) {
      router.replace(next);
    }
  }, [user, loading, next, router]);

  if (loading) return null;

  return (
    <div className="flex w-full min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-14">
      <Card className="w-full max-w-md bg-card/85 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg">
        <CardHeader className="gap-2 px-8 pt-8 pb-6">
          <div className="mb-1 flex items-center gap-2 text-base font-semibold tracking-tight">
            <Hammer className="size-4.5 text-primary" />
            Rancang
          </div>
          <CardTitle className="text-2xl leading-tight font-semibold tracking-tight">
            {tabs === "signup" ? "Create your account" : "Sign in to Rancang"}
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            {tabs === "signup"
              ? "Start turning your ideas into actionable blueprints."
              : "Welcome back. Sign in to continue to your workspace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-8 pb-8">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist">
            <Button
              type="button"
              variant={tabs === "signin" ? "default" : "ghost"}
              size="lg"
              aria-pressed={tabs === "signin"}
              onClick={() => setTabs("signin")}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant={tabs === "signup" ? "default" : "ghost"}
              size="lg"
              aria-pressed={tabs === "signup"}
              onClick={() => setTabs("signup")}
            >
              Sign up
            </Button>
          </div>

          <EmailPasswordForm mode={tabs} onSuccess={() => router.replace(next)} />

          {firebaseEnabled ? (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">or continue with</span>
                <Separator className="flex-1" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={cn("w-full gap-2.5 py-2.5 text-[0.95rem]")}
                onClick={() => signIn()}
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Sign-in isn&apos;t configured for this deployment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}