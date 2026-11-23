import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";
import { ensureBusinessPremiumSchema } from "@/lib/premium";

export async function GET() {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await Promise.all([ensureCreatorSchema(), ensureBusinessPremiumSchema()]);
    const [posts, premium] = await Promise.all([
      sql`SELECT p.id, p.user_id, p.business_id, p.body, p.media_url, p.media_type, p.created_at, p.updated_at,
          COALESCE(u.full_name, b.name) AS author_name, u.avatar_url AS author_avatar_url,
          (p.business_id IS NOT NULL) AS is_business,
          (SELECT COUNT(*)::int FROM creator_post_likes l WHERE l.post_id = p.id) AS like_count,
          (SELECT COUNT(*)::int FROM creator_post_comments c WHERE c.post_id = p.id) AS comment_count
        FROM creator_posts p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN businesses b ON b.id = p.business_id
        WHERE p.business_id IS NOT NULL OR COALESCE(u.email_verified, false) = true
        ORDER BY p.created_at DESC LIMIT 100`,
      sql`SELECT ends_at, is_permanent FROM contributor_premium_subscriptions WHERE business_id = ${session.businessId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) ORDER BY ends_at DESC LIMIT 1`,
    ]);
    return NextResponse.json({ posts: posts.map((post) => ({ ...post, id: Number(post.id), user_id: post.user_id === null ? null : Number(post.user_id), business_id: post.business_id === null ? null : Number(post.business_id), is_business: Boolean(post.is_business), like_count: Number(post.like_count), comment_count: Number(post.comment_count) })), premium: { active: Boolean(premium[0]), endsAt: premium[0]?.ends_at ?? null, permanent: Boolean(premium[0]?.is_permanent) } });
  } catch (error) {
    console.error("Business Creator feed failed:", error);
    return NextResponse.json({ error: "Creator feed could not load right now." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const mediaUrl = payload.mediaUrl ?? null;
  const mediaType = payload.mediaType ?? null;
  if (body.length > 1200 || (body.length < 3 && !mediaUrl)) return NextResponse.json({ error: "Add a message between 3 and 1,200 characters." }, { status: 400 });
  try {
    await ensureBusinessPremiumSchema();
    const active = await sql`SELECT 1 FROM contributor_premium_subscriptions WHERE business_id = ${session.businessId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) LIMIT 1`;
    const isPremium = active.length > 0;
    if (!isPremium && (body.length > 280 || mediaUrl !== null)) return NextResponse.json({ error: "Business Premium is required for longer posts, photos, and videos." }, { status: 403 });
    if (mediaUrl !== null) {
      const validType = mediaType === "image" ? /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/ : mediaType === "video" ? /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+$/ : false;
      const maxLength = mediaType === "image" ? 2_800_000 : 4_200_000;
      if (typeof mediaUrl !== "string" || !validType || mediaUrl.length > maxLength) return NextResponse.json({ error: mediaType === "image" ? "Choose a JPG, PNG or WebP image under 2 MB." : "Choose an MP4, WebM or MOV video under 3 MB." }, { status: 400 });
    } else if (mediaType !== null) return NextResponse.json({ error: "Invalid media attachment." }, { status: 400 });
    const rows = await sql`INSERT INTO creator_posts (user_id, business_id, body, media_url, media_type) VALUES (NULL, ${session.businessId}, ${body || " "}, ${mediaUrl}, ${mediaType}) RETURNING id`;
    return NextResponse.json({ ok: true, postId: Number(rows[0]?.id) }, { status: 201 });
  } catch (error) {
    console.error("Business Creator post failed:", error);
    return NextResponse.json({ error: "Your post could not be published." }, { status: 503 });
  }
}
