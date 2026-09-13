import { NextRequest, NextResponse } from "next/server";
import { getMembers } from "@/lib/groups";

export async function GET(request: NextRequest) {
  const groupId = Number(request.nextUrl.searchParams.get("groupId"));
  if (!Number.isInteger(groupId) || groupId < 0) {
    return NextResponse.json({ error: "invalid groupId" }, { status: 400 });
  }
  const members = await getMembers(groupId);
  if (members.length === 0) {
    return NextResponse.json({ error: "unknown group" }, { status: 404 });
  }
  return NextResponse.json({ groupId, count: members.length, members });
}