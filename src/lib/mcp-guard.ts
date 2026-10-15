import { NextResponse } from "next/server";

export function mcpGuard(): NextResponse | null {
  if (process.env.NODE_ENV === "production" && process.env.MCP_ENABLED !== "1") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
