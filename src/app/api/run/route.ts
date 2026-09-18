import { NextResponse } from "next/server";
import { callFunction } from "@/lib/functions";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { status, json } = await callFunction("run", { county: body?.county });
  return NextResponse.json(json, { status });
}
