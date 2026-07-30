import { NextResponse } from "next/server";
import { getAvailableModels, getDefaultModel } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ models: getAvailableModels(), defaultModel: getDefaultModel() });
}
