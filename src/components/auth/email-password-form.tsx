"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { firebaseAuthError } from "@/lib/firebase-auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/components/ui/toast";

type Props = {
  mode: "signin" | "signup";
  onSuccess: () => void;
};

export function EmailPasswordForm({ mode, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err) {
      setError(firebaseAuthError((err as { code?: string })?.code));
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toastManager.add({
        title: "Reset link sent",
        description: "Check your inbox for instructions.",
      });
      setForgot(false);
      setSubmitting(false);
    } catch (err) {
      setError(firebaseAuthError((err as { code?: string })?.code));
      setSubmitting(false);
    }
  };

  if (forgot) {
    return (
      <form onSubmit={handleForgot} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="h-10 px-3.5 text-sm"
            required
          />
        </div>
        <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Send reset link
        </Button>
        <Button type="button" variant="outline" onClick={() => setForgot(false)} className="w-full">
          Back to sign in
        </Button>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>
    );
  }

  const submittingLabel =
    mode === "signup" ? "Creating account..." : "Signing in...";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="h-10 px-3.5 text-sm"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setForgot(true);
              }}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            className="h-10 px-3.5 pr-10 text-sm"
            minLength={mode === "signup" ? 6 : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {submitting
          ? submittingLabel
          : mode === "signup"
            ? "Create account"
            : "Sign in"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </form>
  );
}