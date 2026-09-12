import { NextResponse } from "next/server";
import { getAvailableModels, getDefaultModel } from "@/lib/models";
import { rateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const limiter = rateLimiter(60, 60_000);

export async function GET(req: Request) {
  const blocked = limiter.check(req);
  if (blocked) return blocked;

  return NextResponse.json({ models: getAvailableModels(), defaultModel: getDefaultModel() });
}
