"use client";

import { Suspense } from "react";
import LandingBackground from "@/components/effects/landing-background";
import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <>
      <LandingBackground />
      <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-4">
        <Suspense fallback={null}>
          <LoginCard />
        </Suspense>
      </div>
    </>
  );
}