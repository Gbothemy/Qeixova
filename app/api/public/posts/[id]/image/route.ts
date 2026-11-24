import { NextRequest, NextResponse } from "next/server";
import { getPublicCreatorPost } from "@/lib/publicCreatorPost";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const post = await getPublicCreatorPost(Number(id)).catch(() => null);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const mediaImage = post.mediaType === "image" ? post.mediaUrl : null;
  const source = mediaImage || post.authorAvatarUrl;
  const image = typeof source === "string" ? source.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i) : null;
  if (!image) return NextResponse.redirect(new URL("/qeixova-logo.png", _request.url), 302);

  const bytes = Buffer.from(image[2], "base64");
  if (bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: "Preview image is too large." }, { status: 413 });
  return new NextResponse(bytes, { headers: { "Content-Type": image[1].toLowerCase(), "Content-Disposition": "inline; filename=qeixova-post-preview", "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
}
