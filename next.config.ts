import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // NOTE: with output:"standalone", run the server with
  //   node .next/standalone/server.js -p <port>
  // "next start" prints a warning and may not serve correctly.

  // Security headers — lightweight subset (no CSP to avoid breaking Firebase Auth).
  // If CSP is needed later, test against Firebase/Google Fonts origins first.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options",           value: "DENY" },
        { key: "X-Content-Type-Options",    value: "nosniff" },
        { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        { key: "X-DNS-Prefetch-Control",    value: "on" },
      ],
    },
  ],
};

export default nextConfig;