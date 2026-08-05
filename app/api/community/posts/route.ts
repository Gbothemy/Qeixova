import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createContributorNotification } from "@/lib/contributorNotifications";

async function ensureCommunityTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS community_posts (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'General',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS community_post_comments (
      id SERIAL PRIMARY KEY,
      post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS community_post_reactions (
      post_id INT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id)
    )
  `;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCommunityTables();

  const posts = await sql`
    SELECT
      p.id, p.body, p.topic, p.created_at,
      u.full_name AS author_name,
      COALESCE(l.name, 'Starter') AS author_level,
      COALESCE(l.badge_color, '#1AEF22') AS badge_color,
      COUNT(DISTINCT r.user_id)::int AS reaction_count,
      COUNT(DISTINCT c.id)::int AS comment_count,
      BOOL_OR(r.user_id = ${session.userId}) AS reacted
    FROM community_posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN levels l ON l.id = u.level_id
    LEFT JOIN community_post_reactions r ON r.post_id = p.id
    LEFT JOIN community_post_comments c ON c.post_id = p.id
    GROUP BY p.id, u.full_name, l.name, l.badge_color
    ORDER BY p.created_at DESC
    LIMIT 25
  `;

  const comments = await sql`
    SELECT
      c.id, c.post_id, c.body, c.created_at,
      u.full_name AS author_name
    FROM community_post_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.post_id IN (
      SELECT id FROM community_posts ORDER BY created_at DESC LIMIT 25
    )
    ORDER BY c.created_at ASC
  `;

  const commentsByPost = new Map<number, typeof comments>();
  for (const comment of comments) {
    const postId = Number(comment.post_id);
    commentsByPost.set(postId, [...(commentsByPost.get(postId) ?? []), comment]);
  }

  return NextResponse.json({
    posts: posts.map((post) => ({
      ...post,
      comments: commentsByPost.get(Number(post.id)) ?? [],
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCommunityTables();
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "create_post";

  if (action === "create_post") {
    const content = typeof body.body === "string" ? body.body.trim() : "";
    const topic = typeof body.topic === "string" && body.topic.trim() ? body.topic.trim().slice(0, 40) : "General";
    if (content.length < 3) return NextResponse.json({ error: "Write something before posting." }, { status: 400 });
    if (content.length > 800) return NextResponse.json({ error: "Posts must be 800 characters or less." }, { status: 400 });

    await sql`
      INSERT INTO community_posts (user_id, body, topic)
      VALUES (${session.userId}, ${content}, ${topic})
    `;
    return NextResponse.json({ ok: true });
  }

  if (action === "comment") {
    const postId = Number(body.postId);
    const content = typeof body.body === "string" ? body.body.trim() : "";
    if (!Number.isFinite(postId)) return NextResponse.json({ error: "Post not found." }, { status: 400 });
    if (content.length < 2) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
    if (content.length > 300) return NextResponse.json({ error: "Comments must be 300 characters or less." }, { status: 400 });

    const postRows = await sql`
      SELECT p.user_id, u.full_name
      FROM community_posts p
      JOIN users u ON u.id = ${session.userId}
      WHERE p.id = ${postId}
      LIMIT 1
    `;

    await sql`
      INSERT INTO community_post_comments (post_id, user_id, body)
      VALUES (${postId}, ${session.userId}, ${content})
    `;
    if (postRows.length > 0 && Number(postRows[0].user_id) !== session.userId) {
      await createContributorNotification({
        userId: Number(postRows[0].user_id),
        type: "growth_activity",
        title: "New comment on your post",
        message: `${postRows[0].full_name || "A contributor"} commented: ${content.slice(0, 120)}`,
        href: "/growth",
        metadata: { postId, actorId: session.userId },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_reaction") {
    const postId = Number(body.postId);
    if (!Number.isFinite(postId)) return NextResponse.json({ error: "Post not found." }, { status: 400 });

    const existing = await sql`
      SELECT post_id FROM community_post_reactions
      WHERE post_id = ${postId} AND user_id = ${session.userId}
      LIMIT 1
    `;
    if (existing.length > 0) {
      await sql`DELETE FROM community_post_reactions WHERE post_id = ${postId} AND user_id = ${session.userId}`;
    } else {
      const postRows = await sql`
        SELECT p.user_id, u.full_name
        FROM community_posts p
        JOIN users u ON u.id = ${session.userId}
        WHERE p.id = ${postId}
        LIMIT 1
      `;
      await sql`
        INSERT INTO community_post_reactions (post_id, user_id)
        VALUES (${postId}, ${session.userId})
        ON CONFLICT DO NOTHING
      `;
      if (postRows.length > 0 && Number(postRows[0].user_id) !== session.userId) {
        await createContributorNotification({
          userId: Number(postRows[0].user_id),
          type: "growth_activity",
          title: "Reaction on your post",
          message: `${postRows[0].full_name || "A contributor"} marked your growth feed post as helpful.`,
          href: "/growth",
          dedupeKey: `post:${postId}:reaction:${session.userId}`,
          metadata: { postId, actorId: session.userId },
        });
      }
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
