import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} = vi.hoisted(() => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
}));

vi.mock("@/lib/firebase-client", () => ({
  auth: {},
  firebaseEnabled: true,
  app: undefined,
}));

vi.mock("@/components/ui/toast", () => ({
  toastManager: { add: vi.fn() },
}));

import { EmailPasswordForm } from "@/components/auth/email-password-form";

describe("EmailPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders signin mode with email, password, sign in button and forgot link", () => {
    render(<EmailPasswordForm mode="signin" onSuccess={vi.fn()} />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeTruthy();
  });

  it("toggles password visibility between password and text", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm mode="signin" onSuccess={vi.fn()} />);

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password.type).toBe("password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.type).toBe("password");
  });

  it("enters forgot flow and returns to sign in", async () => {
    const user = userEvent.setup();
    render(<EmailPasswordForm mode="signin" onSuccess={vi.fn()} />);

    const forgotButton = screen.getByRole("button", { name: "Forgot password?" }) as HTMLButtonElement;
    expect(forgotButton.disabled).toBe(true);

    await user.type(screen.getByLabelText("Email"), "user@example.com");

    const enabledForgot = await screen.findByRole("button", { name: "Forgot password?" });
    expect((enabledForgot as HTMLButtonElement).disabled).toBe(false);

    await user.click(enabledForgot);

    expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to sign in" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Back to sign in" }));

    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forgot password?" })).toBeTruthy();
  });

  it("shows a friendly error for a rejected sign in", async () => {
    signInWithEmailAndPassword.mockRejectedValueOnce({ code: "auth/wrong-password" });
    const user = userEvent.setup();
    render(<EmailPasswordForm mode="signin" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("Incorrect email or password.");
    });
  });

  it("shows a friendly error when the email is already in use during sign up", async () => {
    createUserWithEmailAndPassword.mockRejectedValueOnce({ code: "auth/email-already-in-use" });
    const user = userEvent.setup();
    render(<EmailPasswordForm mode="signup" onSuccess={vi.fn()} />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe("This email is already in use.");
    });
  });
});