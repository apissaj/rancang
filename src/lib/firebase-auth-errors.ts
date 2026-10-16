const MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/email-already-in-use": "This email is already in use.",
  "auth/invalid-email": "Invalid email address.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/operation-not-allowed": "Email/password sign-in is not enabled for this app.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/missing-password": "Please enter your password.",
  "auth/missing-email": "Please enter your email address.",
  "auth/user-disabled": "This account has been disabled.",
};

export function firebaseAuthError(code: string | undefined): string {
  if (code && MESSAGES[code]) return MESSAGES[code];
  return "Something went wrong. Please try again.";
}