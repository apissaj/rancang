import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // NOTE: with output:"standalone", run the server with
  //   node .next/standalone/server.js -p <port>
  // "next start" prints a warning and may not serve correctly.
};

export default nextConfig;