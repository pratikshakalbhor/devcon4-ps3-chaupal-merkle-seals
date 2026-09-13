import { NextRequest, NextResponse } from "next/server";
import { getProof } from "@/lib/proofs";

export async function GET(request: NextRequest) {
  const groupId = Number(request.nextUrl.searchParams.get("groupId"));
  const address = request.nextUrl.searchParams.get("address") ?? "";
  if (!Number.isInteger(groupId) || groupId < 0) {
    return NextResponse.json({ error: "invalid groupId" }, { status: 400 });
  }
  let payload;
  try {
    payload = await getProof(groupId, address);
  } catch {
    return NextResponse.json({ error: "unknown group" }, { status: 404 });
  }
  if (!payload) {
    return NextResponse.json({ error: "address not in group" }, { status: 404 });
  }
  return NextResponse.json(payload);
}