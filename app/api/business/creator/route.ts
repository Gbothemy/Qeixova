import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";
import { ensureBusinessPremiumSchema } from "@/lib/premium";

export async function GET(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await Promise.all([ensureCreatorSchema(), ensureBusinessPremiumSchema()]);
    const requestedPostId = Number(request.nextUrl.searchParams.get("postId"));
    if (Number.isSafeInteger(requestedPostId) && requestedPostId > 0) {
      const comments = await sql`SELECT c.id, c.post_id, c.body, c.created_at, c.user_id, c.business_id,
          COALESCE(u.full_name, b.name) AS author_name, u.avatar_url AS author_avatar_url,
          (c.business_id IS NOT NULL) AS is_business,
          (EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = c.user_id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) OR EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.business_id = c.business_id AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))) AS is_premium,
          (SELECT COUNT(*)::int FROM creator_comment_reactions r WHERE r.comment_id = c.id) AS reaction_count,
          EXISTS(SELECT 1 FROM creator_comment_reactions r WHERE r.comment_id = c.id AND r.business_id = ${session.businessId}) AS reacted
        FROM creator_post_comments c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN businesses b ON b.id = c.business_id
        WHERE c.post_id = ${requestedPostId} ORDER BY c.created_at ASC LIMIT 100`;
      return NextResponse.json({ comments: comments.map((comment) => ({ ...comment, id: Number(comment.id), post_id: Number(comment.post_id), user_id: comment.user_id == null ? null : Number(comment.user_id), business_id: comment.business_id == null ? null : Number(comment.business_id), is_business: Boolean(comment.is_business), is_premium: Boolean(comment.is_premium), reaction_count: Number(comment.reaction_count), reacted: Boolean(comment.reacted) })) });
    }
    const requestedTab = request.nextUrl.searchParams.get("tab");
    const feedTab = ["following", "popular", "saved", "businesses", "contributors"].includes(requestedTab || "") ? requestedTab! : "for-you";
    const offsetValue = Number(request.nextUrl.searchParams.get("offset") || 0);
    const offset = Number.isSafeInteger(offsetValue) ? Math.max(0, Math.min(offsetValue, 100_000)) : 0;
    const [posts, premium] = await Promise.all([
      sql`SELECT p.id, p.user_id, p.business_id, p.body, p.media_url, p.media_type, p.created_at, p.updated_at,
          COALESCE(u.full_name, b.name) AS author_name, u.avatar_url AS author_avatar_url,
          (p.business_id IS NOT NULL) AS is_business,
          (EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = p.user_id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))
            OR EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.business_id = p.business_id AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))) AS is_premium,
          (SELECT COUNT(*)::int FROM creator_post_likes l WHERE l.post_id = p.id) AS like_count,
          (SELECT COUNT(*)::int FROM creator_post_comments c WHERE c.post_id = p.id) AS comment_count,
          (SELECT COUNT(*)::int FROM creator_post_reposts r WHERE r.post_id = p.id) AS repost_count,
          EXISTS(SELECT 1 FROM creator_post_likes l WHERE l.post_id = p.id AND l.business_id = ${session.businessId}) AS liked,
          EXISTS(SELECT 1 FROM creator_post_reposts r WHERE r.post_id = p.id AND r.business_id = ${session.businessId}) AS reposted,
          EXISTS(SELECT 1 FROM creator_post_bookmarks bm WHERE bm.post_id = p.id AND bm.business_id = ${session.businessId}) AS bookmarked
          , (p.business_id = ${session.businessId}) AS is_own,
          EXISTS(SELECT 1 FROM creator_business_follows f WHERE f.business_id = ${session.businessId} AND f.creator_id = p.user_id) AS followed
        FROM creator_posts p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN businesses b ON b.id = p.business_id
        WHERE (p.business_id IS NOT NULL OR COALESCE(u.email_verified, false) = true)
          AND (${feedTab} <> 'following' OR EXISTS(SELECT 1 FROM creator_business_follows f WHERE f.business_id = ${session.businessId} AND f.creator_id = p.user_id))
          AND (${feedTab} <> 'saved' OR EXISTS(SELECT 1 FROM creator_post_bookmarks bm WHERE bm.post_id = p.id AND bm.business_id = ${session.businessId}))
          AND (${feedTab} <> 'businesses' OR p.business_id IS NOT NULL)
          AND (${feedTab} <> 'contributors' OR p.user_id IS NOT NULL)
          AND (p.user_id IS NULL OR NOT EXISTS(SELECT 1 FROM creator_business_muted_users m WHERE m.business_id = ${session.businessId} AND m.muted_user_id = p.user_id))
        ORDER BY CASE WHEN ${feedTab} = 'popular' THEN (SELECT COUNT(*) FROM creator_post_likes l WHERE l.post_id = p.id) * 2 + (SELECT COUNT(*) FROM creator_post_views v WHERE v.post_id = p.id) END DESC NULLS LAST, p.created_at DESC LIMIT 30 OFFSET ${offset}`,
      sql`SELECT ends_at, is_permanent FROM contributor_premium_subscriptions WHERE business_id = ${session.businessId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) ORDER BY ends_at DESC LIMIT 1`,
    ]);
    return NextResponse.json({ posts: posts.map((post) => ({ ...post, id: Number(post.id), user_id: post.user_id === null ? null : Number(post.user_id), business_id: post.business_id === null ? null : Number(post.business_id), is_business: Boolean(post.is_business), is_own: Boolean(post.is_own), is_premium: Boolean(post.is_premium), edited: new Date(post.updated_at).getTime() > new Date(post.created_at).getTime() + 1000, like_count: Number(post.like_count), comment_count: Number(post.comment_count), repost_count: Number(post.repost_count), liked: Boolean(post.liked), reposted: Boolean(post.reposted), bookmarked: Boolean(post.bookmarked), followed: Boolean(post.followed) })), premium: { active: Boolean(premium[0]), endsAt: premium[0]?.ends_at ?? null, permanent: Boolean(premium[0]?.is_permanent) }, hasMore: posts.length === 30 });
  } catch (error) {
    console.error("Business Creator feed failed:", error);
    return NextResponse.json({ error: "Creator feed could not load right now." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "publish";
  try {
    await ensureCreatorSchema();
    if (action === "toggle_follow" || action === "toggle_mute") {
      const creatorId = Number(payload.creatorId);
      if (!Number.isSafeInteger(creatorId) || creatorId <= 0) return NextResponse.json({ error: "Choose a valid contributor." }, { status: 400 });
      const creator = await sql`SELECT id FROM users WHERE id = ${creatorId} AND COALESCE(email_verified, false) = true LIMIT 1`;
      if (!creator.length) return NextResponse.json({ error: "That contributor is not available." }, { status: 404 });
      const table = action === "toggle_follow" ? "follow" : "mute";
      let existing: unknown[];
      if (table === "follow") existing = await sql`SELECT 1 FROM creator_business_follows WHERE business_id = ${session.businessId} AND creator_id = ${creatorId} LIMIT 1`;
      else existing = await sql`SELECT 1 FROM creator_business_muted_users WHERE business_id = ${session.businessId} AND muted_user_id = ${creatorId} LIMIT 1`;
      if (existing.length) {
        if (table === "follow") await sql`DELETE FROM creator_business_follows WHERE business_id = ${session.businessId} AND creator_id = ${creatorId}`;
        else await sql`DELETE FROM creator_business_muted_users WHERE business_id = ${session.businessId} AND muted_user_id = ${creatorId}`;
      } else if (table === "follow") {
        await sql`INSERT INTO creator_business_follows (business_id, creator_id) VALUES (${session.businessId}, ${creatorId}) ON CONFLICT DO NOTHING`;
      } else {
        await sql`INSERT INTO creator_business_muted_users (business_id, muted_user_id) VALUES (${session.businessId}, ${creatorId}) ON CONFLICT DO NOTHING`;
      }
      return NextResponse.json({ ok: true, [table === "follow" ? "followed" : "muted"]: !existing.length });
    }
    if (action === "toggle_comment_reaction") {
      const commentId = Number(payload.commentId);
      if (!Number.isSafeInteger(commentId) || commentId <= 0) return NextResponse.json({ error: "Comment not found." }, { status: 400 });
      const comment = await sql`SELECT id FROM creator_post_comments WHERE id = ${commentId} LIMIT 1`;
      if (!comment.length) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      const existing = await sql`SELECT 1 FROM creator_comment_reactions WHERE comment_id = ${commentId} AND business_id = ${session.businessId} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM creator_comment_reactions WHERE comment_id = ${commentId} AND business_id = ${session.businessId}`;
      else await sql`INSERT INTO creator_comment_reactions (comment_id, user_id, business_id) VALUES (${commentId}, NULL, ${session.businessId}) ON CONFLICT DO NOTHING`;
      const count = await sql`SELECT COUNT(*)::int AS reaction_count FROM creator_comment_reactions WHERE comment_id = ${commentId}`;
      return NextResponse.json({ ok: true, active: !existing.length, reactionCount: Number(count[0]?.reaction_count ?? 0) });
    }
    const postId = Number(payload.postId);
    if (action !== "publish") {
      if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
      const post = await sql`SELECT id, user_id, business_id FROM creator_posts WHERE id = ${postId} LIMIT 1`;
      if (!post.length) return NextResponse.json({ error: "Post not found." }, { status: 404 });
      const ownPost = Number(post[0].business_id) === session.businessId;
      if (action === "toggle_like" || action === "toggle_repost" || action === "toggle_bookmark") {
        if (ownPost && action === "toggle_like") return NextResponse.json({ error: "You cannot like your own post." }, { status: 400 });
        const table = action === "toggle_like" ? "like" : action === "toggle_repost" ? "repost" : "bookmark";
        let existing: unknown[];
        if (table === "like") existing = await sql`SELECT 1 FROM creator_post_likes WHERE post_id = ${postId} AND business_id = ${session.businessId} LIMIT 1`;
        else if (table === "repost") existing = await sql`SELECT 1 FROM creator_post_reposts WHERE post_id = ${postId} AND business_id = ${session.businessId} LIMIT 1`;
        else existing = await sql`SELECT 1 FROM creator_post_bookmarks WHERE post_id = ${postId} AND business_id = ${session.businessId} LIMIT 1`;
        if (existing.length) {
          if (table === "like") await sql`DELETE FROM creator_post_likes WHERE post_id = ${postId} AND business_id = ${session.businessId}`;
          else if (table === "repost") await sql`DELETE FROM creator_post_reposts WHERE post_id = ${postId} AND business_id = ${session.businessId}`;
          else await sql`DELETE FROM creator_post_bookmarks WHERE post_id = ${postId} AND business_id = ${session.businessId}`;
        } else {
          if (table === "like") await sql`INSERT INTO creator_post_likes (post_id, user_id, business_id) VALUES (${postId}, NULL, ${session.businessId}) ON CONFLICT DO NOTHING`;
          else if (table === "repost") await sql`INSERT INTO creator_post_reposts (post_id, user_id, business_id) VALUES (${postId}, NULL, ${session.businessId}) ON CONFLICT DO NOTHING`;
          else await sql`INSERT INTO creator_post_bookmarks (post_id, user_id, business_id) VALUES (${postId}, NULL, ${session.businessId}) ON CONFLICT DO NOTHING`;
        }
        const counts = await sql`SELECT (SELECT COUNT(*)::int FROM creator_post_likes WHERE post_id = ${postId}) AS like_count, (SELECT COUNT(*)::int FROM creator_post_reposts WHERE post_id = ${postId}) AS repost_count`;
        return NextResponse.json({ ok: true, active: !existing.length, liked: table === "like" ? !existing.length : undefined, reposted: table === "repost" ? !existing.length : undefined, bookmarked: table === "bookmark" ? !existing.length : undefined, likeCount: Number(counts[0]?.like_count ?? 0), repostCount: Number(counts[0]?.repost_count ?? 0) });
      }
      if (action === "comment") {
        const commentBody = typeof payload.body === "string" ? payload.body.trim() : "";
        if (!commentBody || commentBody.length > 500) return NextResponse.json({ error: "Replies must contain 1 to 500 characters." }, { status: 400 });
        const rows = await sql`INSERT INTO creator_post_comments (post_id, user_id, business_id, body) VALUES (${postId}, NULL, ${session.businessId}, ${commentBody}) RETURNING id, post_id, user_id, business_id, body, created_at`;
        const premium = await sql`SELECT EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.business_id = ${session.businessId} AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) AS active`;
        return NextResponse.json({ ok: true, comment: { ...rows[0], id: Number(rows[0].id), post_id: Number(rows[0].post_id), user_id: null, business_id: session.businessId, author_name: session.name, is_business: true, is_premium: Boolean(premium[0]?.active), reaction_count: 0, reacted: false } }, { status: 201 });
      }
      return NextResponse.json({ error: "Unsupported creator action." }, { status: 400 });
    }
  } catch (error) {
    console.error("Business Creator action failed:", error);
    return NextResponse.json({ error: "That Creator feed action could not be completed." }, { status: 503 });
  }
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const mediaUrl = payload.mediaUrl ?? null;
  const mediaType = payload.mediaType ?? null;
  if (body.length > 1200 || (body.length < 1 && !mediaUrl)) return NextResponse.json({ error: "Write at least one character or attach media." }, { status: 400 });
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

export async function PATCH(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const postId = Number(payload.postId);
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
  if (body.length < 1 || body.length > 1200) return NextResponse.json({ error: "Posts must contain 1 to 1,200 characters." }, { status: 400 });
  try {
    await ensureCreatorSchema();
    const rows = await sql`UPDATE creator_posts SET body = ${body}, updated_at = NOW() WHERE id = ${postId} AND business_id = ${session.businessId} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "You can only edit your own posts." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Business Creator post edit failed:", error);
    return NextResponse.json({ error: "Your post could not be updated. Please try again." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const postId = Number(request.nextUrl.searchParams.get("postId"));
  if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
  try {
    await ensureCreatorSchema();
    const rows = await sql`DELETE FROM creator_posts WHERE id = ${postId} AND business_id = ${session.businessId} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "You can only delete your own posts." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Business Creator post delete failed:", error);
    return NextResponse.json({ error: "Your post could not be deleted. Please try again." }, { status: 503 });
  }
}
