import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { createContributorNotification } from "@/lib/contributorNotifications";
import { sql } from "@/lib/db";
import { ensurePremiumSubscriptionTable } from "@/lib/premium";

async function notifyCreator(userId: number, title: string, message: string, href: string, dedupeKey: string) {
  try {
    await createContributorNotification({ userId, type: "growth_activity", title, message, href, dedupeKey });
  } catch (error) {
    console.error("Creator activity notification failed:", error);
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureCreatorSchema();
    await ensurePremiumSubscriptionTable();
    const requestedPostId = Number(request.nextUrl.searchParams.get("postId"));
    if (Number.isSafeInteger(requestedPostId) && requestedPostId > 0) {
      const comments = await sql`
        SELECT c.id, c.post_id, c.body, c.created_at, c.user_id, u.full_name AS author_name, u.avatar_url AS author_avatar_url,
          EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = c.user_id AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) AS is_premium,
          (SELECT COUNT(*)::int FROM creator_comment_reactions r WHERE r.comment_id = c.id) AS reaction_count,
          EXISTS(SELECT 1 FROM creator_comment_reactions r WHERE r.comment_id = c.id AND r.user_id = ${session.userId}) AS reacted
        FROM creator_post_comments c JOIN users u ON u.id = c.user_id
        WHERE c.post_id = ${requestedPostId}
        ORDER BY c.created_at ASC LIMIT 100
      `;
      return NextResponse.json({ comments: comments.map((comment) => ({
        ...comment,
        id: Number(comment.id),
        post_id: Number(comment.post_id),
        user_id: Number(comment.user_id),
        reaction_count: Number(comment.reaction_count),
        reacted: Boolean(comment.reacted),
      })) });
    }
    const offsetValue = Number(request.nextUrl.searchParams.get("offset") || 0);
    const offset = Number.isSafeInteger(offsetValue) ? Math.max(0, Math.min(offsetValue, 100_000)) : 0;
    const requestedTab = request.nextUrl.searchParams.get("tab");
    const feedTab = requestedTab === "following" || requestedTab === "popular" || requestedTab === "saved" ? requestedTab : "for-you";
    await ensurePremiumSubscriptionTable();
    const posts = await sql`
      SELECT p.id, p.user_id, p.business_id, p.body, p.media_url, p.media_type, p.created_at, p.updated_at, COALESCE(u.full_name, bu.name) AS author_name, u.avatar_url AS author_avatar_url,
        EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps
          WHERE ps.user_id = p.user_id AND ps.status = 'active'
            AND ps.business_id IS NULL AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW()))
          OR EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps
          WHERE ps.business_id = p.business_id AND ps.status = 'active'
            AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) AS is_premium,
        COUNT(DISTINCT l.user_id)::int AS like_count,
        COUNT(DISTINCT v.viewer_id)::int AS view_count,
        COUNT(DISTINCT c.id)::int AS comment_count,
        COUNT(DISTINCT r.user_id)::int AS repost_count,
        COALESCE(BOOL_OR(l.user_id = ${session.userId}), false) AS liked,
        COALESCE(BOOL_OR(r.user_id = ${session.userId}), false) AS reposted,
        COALESCE(BOOL_OR(b.user_id = ${session.userId}), false) AS bookmarked,
        EXISTS(SELECT 1 FROM creator_follows f WHERE f.follower_id = ${session.userId} AND f.creator_id = p.user_id) AS followed
      FROM creator_posts p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN businesses bu ON bu.id = p.business_id
      LEFT JOIN creator_post_likes l ON l.post_id = p.id
      LEFT JOIN creator_post_views v ON v.post_id = p.id
      LEFT JOIN creator_post_comments c ON c.post_id = p.id
      LEFT JOIN creator_post_reposts r ON r.post_id = p.id
      LEFT JOIN creator_post_bookmarks b ON b.post_id = p.id
      WHERE (${feedTab} <> 'following' OR EXISTS (
          SELECT 1 FROM creator_follows f WHERE f.follower_id = ${session.userId} AND f.creator_id = p.user_id
        ))
        AND (${feedTab} <> 'saved' OR EXISTS (
          SELECT 1 FROM creator_post_bookmarks saved WHERE saved.user_id = ${session.userId} AND saved.post_id = p.id
        ))
        AND (p.user_id = ${session.userId} OR NOT EXISTS (
          SELECT 1 FROM creator_muted_users m WHERE m.user_id = ${session.userId} AND m.muted_user_id = p.user_id
        ))
      GROUP BY p.id, u.full_name, u.avatar_url, bu.name
      ORDER BY CASE WHEN ${feedTab} = 'popular' THEN COUNT(DISTINCT l.user_id) * 2 + COUNT(DISTINCT v.viewer_id) END DESC NULLS LAST,
        p.created_at DESC
      LIMIT 30 OFFSET ${offset}
    `;
    const summary = await sql`
      SELECT COUNT(*)::int AS post_count,
        COALESCE(SUM((SELECT COUNT(*) FROM creator_post_views v WHERE v.post_id = p.id)), 0)::int AS view_count,
        COALESCE(SUM((SELECT COUNT(*) FROM creator_post_likes l WHERE l.post_id = p.id)), 0)::int AS like_count,
        (SELECT COUNT(*)::int FROM creator_follows f WHERE f.follower_id = ${session.userId}) AS following_count
      FROM creator_posts p WHERE p.user_id = ${session.userId}
    `;
    const premiumAccess = await sql`SELECT 1 FROM contributor_premium_subscriptions WHERE user_id = ${session.userId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) LIMIT 1`;
    return NextResponse.json({
      posts: posts.map((post) => ({
        ...post,
        id: Number(post.id),
        user_id: post.user_id === null ? null : Number(post.user_id),
        business_id: post.business_id === null ? null : Number(post.business_id),
        is_business: post.business_id !== null,
        is_premium: Boolean(post.is_premium),
        edited: new Date(post.updated_at).getTime() > new Date(post.created_at).getTime() + 1000,
        like_count: Number(post.like_count),
        view_count: Number(post.view_count),
        comment_count: Number(post.comment_count),
        repost_count: Number(post.repost_count),
        liked: Boolean(post.liked),
        reposted: Boolean(post.reposted),
        bookmarked: Boolean(post.bookmarked),
        followed: Boolean(post.followed),
      })),
      canPostMedia: premiumAccess.length > 0,
      summary: {
        post_count: Number(summary[0]?.post_count ?? 0),
        view_count: Number(summary[0]?.view_count ?? 0),
        like_count: Number(summary[0]?.like_count ?? 0),
        following_count: Number(summary[0]?.following_count ?? 0),
      },
      hasMore: posts.length === 30,
    });
  } catch (error) {
    console.error("Creator feed load failed:", error);
    return NextResponse.json({ error: "Creator Studio could not load right now. Please try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));
  const action = typeof payload.action === "string" ? payload.action : "publish";
  try {
    await ensureCreatorSchema();
    if (action === "toggle_comment_reaction") {
      const commentId = Number(payload.commentId);
      if (!Number.isSafeInteger(commentId) || commentId <= 0) return NextResponse.json({ error: "Comment not found." }, { status: 400 });
      const comment = await sql`SELECT id FROM creator_post_comments WHERE id = ${commentId} LIMIT 1`;
      if (!comment.length) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
      const existing = await sql`SELECT 1 FROM creator_comment_reactions WHERE comment_id = ${commentId} AND user_id = ${session.userId} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM creator_comment_reactions WHERE comment_id = ${commentId} AND user_id = ${session.userId}`;
      else await sql`INSERT INTO creator_comment_reactions (comment_id, user_id) VALUES (${commentId}, ${session.userId}) ON CONFLICT DO NOTHING`;
      const count = await sql`SELECT COUNT(*)::int AS reaction_count FROM creator_comment_reactions WHERE comment_id = ${commentId}`;
      return NextResponse.json({ ok: true, active: !existing.length, reactionCount: Number(count[0]?.reaction_count ?? 0) });
    }
    if (action === "publish") {
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      const mediaUrl = payload.mediaUrl ?? null;
      const mediaType = payload.mediaType ?? null;
      if (body.length > 1200 || (body.length < 3 && !mediaUrl)) return NextResponse.json({ error: "Add a caption or media to your post." }, { status: 400 });
      if (mediaUrl !== null) {
        await ensurePremiumSubscriptionTable();
        const access = await sql`SELECT 1 FROM contributor_premium_subscriptions WHERE user_id = ${session.userId} AND status = 'active' AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW()) LIMIT 1`;
        if (!access.length) return NextResponse.json({ error: "A Premium subscription is required to post photos and videos." }, { status: 403 });
        const validType = mediaType === "image" ? /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/ : mediaType === "video" ? /^data:video\/(mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+$/ : false;
        const maxLength = mediaType === "image" ? 2_800_000 : 4_200_000;
        if (typeof mediaUrl !== "string" || !validType || mediaUrl.length > maxLength) return NextResponse.json({ error: mediaType === "image" ? "Choose a JPG, PNG or WebP image under 2 MB." : "Choose an MP4, WebM or MOV video under 3 MB." }, { status: 400 });
      } else if (mediaType !== null) return NextResponse.json({ error: "Invalid media attachment." }, { status: 400 });
      const rows = await sql`INSERT INTO creator_posts (user_id, body, media_url, media_type) VALUES (${session.userId}, ${body || " "}, ${mediaUrl}, ${mediaType}) RETURNING id`;
      return NextResponse.json({ ok: true, postId: Number(rows[0]?.id) }, { status: 201 });
    }

    if (action === "toggle_follow") {
      const creatorId = Number(payload.creatorId);
      if (!Number.isSafeInteger(creatorId) || creatorId <= 0 || creatorId === session.userId) {
        return NextResponse.json({ error: "Choose another contributor to follow." }, { status: 400 });
      }
      const creator = await sql`SELECT id FROM users WHERE id = ${creatorId} AND COALESCE(email_verified, false) = true LIMIT 1`;
      if (!creator.length) return NextResponse.json({ error: "That contributor is not available." }, { status: 404 });
      const existing = await sql`SELECT 1 FROM creator_follows WHERE follower_id = ${session.userId} AND creator_id = ${creatorId} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM creator_follows WHERE follower_id = ${session.userId} AND creator_id = ${creatorId}`;
      else {
        await sql`INSERT INTO creator_follows (follower_id, creator_id) VALUES (${session.userId}, ${creatorId}) ON CONFLICT DO NOTHING`;
        await notifyCreator(creatorId, "New contributor following you", `${session.fullName || "A contributor"} followed your creator profile.`, "/creator", `creator-follow:${session.userId}:${creatorId}`);
      }
      return NextResponse.json({ ok: true, followed: !existing.length });
    }

    if (action === "toggle_mute") {
      const creatorId = Number(payload.creatorId);
      if (!Number.isSafeInteger(creatorId) || creatorId <= 0 || creatorId === session.userId) {
        return NextResponse.json({ error: "Choose another contributor to mute." }, { status: 400 });
      }
      const creator = await sql`SELECT id FROM users WHERE id = ${creatorId} AND COALESCE(email_verified, false) = true LIMIT 1`;
      if (!creator.length) return NextResponse.json({ error: "That contributor is not available." }, { status: 404 });
      const existing = await sql`SELECT 1 FROM creator_muted_users WHERE user_id = ${session.userId} AND muted_user_id = ${creatorId} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM creator_muted_users WHERE user_id = ${session.userId} AND muted_user_id = ${creatorId}`;
      else await sql`INSERT INTO creator_muted_users (user_id, muted_user_id) VALUES (${session.userId}, ${creatorId}) ON CONFLICT DO NOTHING`;
      return NextResponse.json({ ok: true, muted: !existing.length });
    }

    const postId = Number(payload.postId);
    if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
    const post = await sql`SELECT id, user_id FROM creator_posts WHERE id = ${postId} LIMIT 1`;
    if (!post.length) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    if (action === "view") {
      if (Number(post[0].user_id) !== session.userId) {
        await sql`INSERT INTO creator_post_views (post_id, viewer_id) VALUES (${postId}, ${session.userId}) ON CONFLICT DO NOTHING`;
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "toggle_like") {
      if (Number(post[0].user_id) === session.userId) return NextResponse.json({ error: "You cannot like your own post." }, { status: 400 });
      const existing = await sql`SELECT 1 FROM creator_post_likes WHERE post_id = ${postId} AND user_id = ${session.userId} LIMIT 1`;
      if (existing.length) await sql`DELETE FROM creator_post_likes WHERE post_id = ${postId} AND user_id = ${session.userId}`;
      else {
        await sql`INSERT INTO creator_post_likes (post_id, user_id) VALUES (${postId}, ${session.userId}) ON CONFLICT DO NOTHING`;
        if (Number(post[0].user_id) !== session.userId) await notifyCreator(Number(post[0].user_id), "Your creator post got a like", `${session.fullName || "A contributor"} liked your post.`, `/creator?post=${postId}`, `creator-like:${postId}:${session.userId}`);
      }
      return NextResponse.json({ ok: true, liked: !existing.length });
    }
    if (action === "comment") {
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      if (!body || body.length > 500) return NextResponse.json({ error: "Replies must contain 1 to 500 characters." }, { status: 400 });
      const rows = await sql`
        INSERT INTO creator_post_comments (post_id, user_id, body)
        VALUES (${postId}, ${session.userId}, ${body}) RETURNING id, post_id, user_id, body, created_at
      `;
      if (Number(post[0].user_id) !== session.userId) await notifyCreator(Number(post[0].user_id), "New reply on your creator post", `${session.fullName || "A contributor"} replied: ${body.slice(0, 100)}`, `/creator?post=${postId}`, `creator-comment:${rows[0].id}`);
      const premium = await sql`SELECT EXISTS(SELECT 1 FROM contributor_premium_subscriptions ps WHERE ps.user_id = ${session.userId} AND ps.business_id IS NULL AND ps.status = 'active' AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())) AS active`;
      return NextResponse.json({ ok: true, comment: { ...rows[0], id: Number(rows[0].id), post_id: Number(rows[0].post_id), user_id: Number(rows[0].user_id), author_name: session.fullName, is_premium: Boolean(premium[0]?.active), reaction_count: 0, reacted: false } }, { status: 201 });
    }
    if (action === "toggle_repost" || action === "toggle_bookmark") {
      const table = action === "toggle_repost" ? "creator_post_reposts" : "creator_post_bookmarks";
      const existing = action === "toggle_repost"
        ? await sql`SELECT 1 FROM creator_post_reposts WHERE post_id = ${postId} AND user_id = ${session.userId} LIMIT 1`
        : await sql`SELECT 1 FROM creator_post_bookmarks WHERE post_id = ${postId} AND user_id = ${session.userId} LIMIT 1`;
      if (existing.length) {
        if (table === "creator_post_reposts") await sql`DELETE FROM creator_post_reposts WHERE post_id = ${postId} AND user_id = ${session.userId}`;
        else await sql`DELETE FROM creator_post_bookmarks WHERE post_id = ${postId} AND user_id = ${session.userId}`;
      } else {
        if (table === "creator_post_reposts") {
          await sql`INSERT INTO creator_post_reposts (post_id, user_id) VALUES (${postId}, ${session.userId}) ON CONFLICT DO NOTHING`;
          if (Number(post[0].user_id) !== session.userId) await notifyCreator(Number(post[0].user_id), "Your creator post was reposted", `${session.fullName || "A contributor"} reposted your post.`, `/creator?post=${postId}`, `creator-repost:${postId}:${session.userId}`);
        }
        else await sql`INSERT INTO creator_post_bookmarks (post_id, user_id) VALUES (${postId}, ${session.userId}) ON CONFLICT DO NOTHING`;
      }
      return NextResponse.json({ ok: true, active: !existing.length });
    }
    return NextResponse.json({ error: "Unsupported creator action." }, { status: 400 });
  } catch (error) {
    console.error("Creator action failed:", error);
    return NextResponse.json({ error: "That creator action could not be completed. Please try again." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  const postId = Number(payload.postId);
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
  if (body.length < 3 || body.length > 1200) return NextResponse.json({ error: "Posts must contain 3 to 1,200 characters." }, { status: 400 });
  try {
    await ensureCreatorSchema();
    const rows = await sql`
      UPDATE creator_posts SET body = ${body}, updated_at = NOW()
      WHERE id = ${postId} AND user_id = ${session.userId}
      RETURNING id
    `;
    if (!rows.length) return NextResponse.json({ error: "You can only edit your own posts." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Creator post edit failed:", error);
    return NextResponse.json({ error: "Your post could not be updated. Please try again." }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const postId = Number(request.nextUrl.searchParams.get("postId"));
  if (!Number.isSafeInteger(postId) || postId <= 0) return NextResponse.json({ error: "Post not found." }, { status: 400 });
  try {
    await ensureCreatorSchema();
    const rows = await sql`DELETE FROM creator_posts WHERE id = ${postId} AND user_id = ${session.userId} RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "You can only delete your own posts." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Creator post delete failed:", error);
    return NextResponse.json({ error: "Your post could not be deleted. Please try again." }, { status: 503 });
  }
}
