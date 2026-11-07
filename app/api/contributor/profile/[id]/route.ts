import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: rawId } = await context.params;
  const creatorId = Number(rawId);
  if (!Number.isSafeInteger(creatorId) || creatorId <= 0) {
    return NextResponse.json({ error: "Contributor not found." }, { status: 404 });
  }

  try {
    await ensureCreatorSchema();
    const [users, posts, follows] = await Promise.all([
      sql`SELECT u.id, u.full_name, u.bio, u.website, u.location, u.occupation, u.created_at,
          COALESCE(l.level_number, u.level, 0) AS level, l.name AS level_name, l.badge_color
        FROM users u LEFT JOIN levels l ON l.id = u.level_id
        WHERE u.id = ${creatorId} AND COALESCE(u.email_verified, false) = true LIMIT 1`,
      sql`SELECT p.id, p.body, p.created_at,
          (SELECT COUNT(*)::int FROM creator_post_likes x WHERE x.post_id = p.id) AS like_count,
          (SELECT COUNT(*)::int FROM creator_post_views x WHERE x.post_id = p.id) AS view_count,
          (SELECT COUNT(*)::int FROM creator_post_comments x WHERE x.post_id = p.id) AS comment_count,
          (SELECT COUNT(*)::int FROM creator_post_reposts x WHERE x.post_id = p.id) AS repost_count
        FROM creator_posts p WHERE p.user_id = ${creatorId}
        ORDER BY p.created_at DESC LIMIT 50`,
      sql`SELECT
          (SELECT COUNT(*)::int FROM creator_follows WHERE creator_id = ${creatorId}) AS follower_count,
          (SELECT COUNT(*)::int FROM creator_follows WHERE follower_id = ${creatorId}) AS following_count,
          EXISTS(SELECT 1 FROM creator_follows WHERE follower_id = ${session.userId} AND creator_id = ${creatorId}) AS followed`,
    ]);

    if (!users.length) return NextResponse.json({ error: "Contributor not found." }, { status: 404 });
    return NextResponse.json({
      profile: {
        ...users[0],
        follower_count: Number(follows[0]?.follower_count ?? 0),
        following_count: Number(follows[0]?.following_count ?? 0),
        followed: Boolean(follows[0]?.followed),
      },
      posts: posts.map((post) => ({
        ...post,
        id: Number(post.id),
        like_count: Number(post.like_count),
        view_count: Number(post.view_count),
        comment_count: Number(post.comment_count),
        repost_count: Number(post.repost_count),
      })),
    });
  } catch (error) {
    console.error("Public contributor profile error:", error);
    return NextResponse.json({ error: "Could not load this contributor profile." }, { status: 500 });
  }
}
