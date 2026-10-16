import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useAuth, replace, push, searchParamsState } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  searchParamsState: { next: null as string | null },
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("@/lib/firebase-client", () => ({
  auth: {},
  firebaseEnabled: true,
  app: undefined,
}));

vi.mock("@/components/ui/toast", () => ({
  toastManager: { add: vi.fn() },
}));

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push }),
  useSearchParams: () => ({
    get: (key: string) => (key === "next" ? searchParamsState.next : null),
  }),
}));

import { LoginCard } from "@/components/auth/login-card";

describe("LoginCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.next = null;
    useAuth.mockReturnValue({
      user: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      storageVersion: 0,
    });
  });

  it("renders sign in and sign up tabs", () => {
    render(<LoginCard />);

    const tabs = screen.getByRole("tablist");
    expect(within(tabs).getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(within(tabs).getByRole("button", { name: "Sign up" })).toBeTruthy();
  });

  it("switches to the sign up view when the sign up tab is clicked", async () => {
    const user = userEvent.setup();
    render(<LoginCard />);

    await user.click(within(screen.getByRole("tablist")).getByRole("button", { name: "Sign up" }));

    expect(screen.getByText("Create your account")).toBeTruthy();
  });

  it("shows the Google continuation option when firebase is enabled", () => {
    render(<LoginCard />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  });

  it("redirects authenticated users to /plan by default", async () => {
    useAuth.mockReturnValue({
      user: { uid: "u1" },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      storageVersion: 0,
    });
    render(<LoginCard />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/plan");
    });
  });

  it("redirects authenticated users to the safe next param", async () => {
    searchParamsState.next = "/projects";
    useAuth.mockReturnValue({
      user: { uid: "u1" },
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      storageVersion: 0,
    });
    render(<LoginCard />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/projects");
    });
  });

  it("renders nothing and does not redirect while loading", async () => {
    useAuth.mockReturnValue({
      user: { uid: "u1" },
      loading: true,
      signIn: vi.fn(),
      signOut: vi.fn(),
      storageVersion: 0,
    });
    const { container } = render(<LoginCard />);

    expect(container.childElementCount).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["https://evil.com", "//evil.com"])(
    "rejects an unsafe next param (%s) and falls back to /plan",
    async (unsafe) => {
      searchParamsState.next = unsafe;
      useAuth.mockReturnValue({
        user: { uid: "u1" },
        loading: false,
        signIn: vi.fn(),
        signOut: vi.fn(),
        storageVersion: 0,
      });
      render(<LoginCard />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/plan");
      });
    }
  );
});