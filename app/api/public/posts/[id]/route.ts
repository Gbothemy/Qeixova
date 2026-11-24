import { NextRequest, NextResponse } from "next/server";
import { getPublicCreatorPost, getPublicPostPreviewImageUrl } from "@/lib/publicCreatorPost";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicCreatorPost(Number(id)).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  const previewImageUrl = getPublicPostPreviewImageUrl(post);
  return NextResponse.json({ post: { id: post.id, body: post.body, mediaType: post.mediaType, createdAt: post.createdAt, authorId: post.authorId, isBusiness: post.isBusiness, authorName: post.authorName, authorBio: post.authorBio, mediaUrl: post.mediaType === "image" ? previewImageUrl : null, previewImageUrl } }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
