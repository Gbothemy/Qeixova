import { NextRequest, NextResponse } from "next/server";
import { getPublicCreatorPost } from "@/lib/publicCreatorPost";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicCreatorPost(Number(id)).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ post }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
