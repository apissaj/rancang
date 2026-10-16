import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { useAuth, replace, pathnameRef, firebaseEnabledRef } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  replace: vi.fn(),
  pathnameRef: { current: "/plan" as string },
  firebaseEnabledRef: { current: true },
}));

vi.mock("@/lib/firebase-client", () => ({
  auth: {},
  app: undefined,
  get firebaseEnabled() {
    return firebaseEnabledRef.current;
  },
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => pathnameRef.current,
}));

import { AuthGate } from "@/components/auth-gate";

describe("AuthGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathnameRef.current = "/plan";
    firebaseEnabledRef.current = true;
  });

  it("redirects anonymous users to login with the encoded next path", async () => {
    useAuth.mockReturnValue({ user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(), storageVersion: 0 });

    render(
      <AuthGate>
        <div>protected</div>
      </AuthGate>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/login?next=%2Fplan");
    });
    expect(screen.queryByText("protected")).toBeNull();
  });

  it("renders children for an authenticated user without redirecting", () => {
    useAuth.mockReturnValue({ user: { uid: "u1" }, loading: false, signIn: vi.fn(), signOut: vi.fn(), storageVersion: 0 });

    render(
      <AuthGate>
        <div>protected</div>
      </AuthGate>,
    );

    expect(screen.getByText("protected")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("renders children directly when firebase is disabled", () => {
    firebaseEnabledRef.current = false;
    useAuth.mockReturnValue({ user: null, loading: false, signIn: vi.fn(), signOut: vi.fn(), storageVersion: 0 });

    render(
      <AuthGate>
        <div>protected</div>
      </AuthGate>,
    );

    expect(screen.getByText("protected")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});