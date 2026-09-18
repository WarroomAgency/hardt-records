import { NextResponse } from "next/server";
import { callFunction } from "@/lib/functions";

export async function POST() {
  const { status, json } = await callFunction("queue", {});
  return NextResponse.json(json, { status });
}
