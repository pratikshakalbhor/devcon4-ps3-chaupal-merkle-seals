import { NextResponse } from "next/server";
import { getGroups, getRoot } from "@/lib/groups";

export async function GET() {
  const groups = await getGroups();
  const payload = Promise.all(
    groups.map(async (g) => ({ ...g, root: await getRoot(g.id) })),
  );
  return NextResponse.json(await payload);
}