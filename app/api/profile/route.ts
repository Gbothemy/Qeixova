import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { displayLevel } from "@/lib/levels";
import { ensureCreatorSchema } from "@/lib/contributorFeatures";
import { ensurePremiumSubscriptionTable } from "@/lib/premium";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureCreatorSchema();
    await ensurePremiumSubscriptionTable();

    const [userRows, taskRows, earnRows, withdrawRows, referralRows, milestoneRows, creatorCounts, creatorPosts, creatorReplies, creatorReposts] = await Promise.all([
      sql`
        SELECT
          u.id, u.email, u.full_name, u.phone, u.bio, u.website, u.location, u.occupation, u.balance, u.streak,
          COALESCE(l.level_number, u.level, 0) AS level,
          l.name AS level_name,
          l.badge_color,
          u.referral_code, u.created_at, u.trust_level, u.approved_count,
          u.rejected_count, u.trust_score, u.xp, u.total_earned_qlt, u.bonus_earned_qlt,
          EXISTS (
            SELECT 1 FROM contributor_premium_subscriptions ps
            WHERE ps.user_id = u.id AND ps.status = 'active'
              AND ps.starts_at <= NOW() AND (ps.is_permanent = TRUE OR ps.ends_at > NOW())
          ) AS is_premium
        FROM users u
        LEFT JOIN levels l ON l.id = u.level_id
        WHERE u.id = ${session.userId}
      `,

      // Total tasks completed — split into all-time and today
      sql`SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN 1 END)::int AS today
        FROM completions
        WHERE user_id = ${session.userId}
          AND status = 'approved'`,

      // Total QLT accumulated (all credits)
      sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE user_id = ${session.userId} AND type = 'credit'`,

      // Total QLT withdrawn
      sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE user_id = ${session.userId} AND type = 'debit' AND status IN ('pending', 'processing', 'completed')`,

      // Referral count
      sql`SELECT COUNT(*)::int AS count FROM users WHERE referred_by = ${session.userId}`,

      // Milestone count
      sql`SELECT COUNT(*)::int AS count FROM user_milestones WHERE user_id = ${session.userId}`,
      sql`SELECT
        (SELECT COUNT(*)::int FROM creator_follows WHERE creator_id = ${session.userId}) AS followers,
        (SELECT COUNT(*)::int FROM creator_follows WHERE follower_id = ${session.userId}) AS following`,
      sql`SELECT p.id, p.body, p.created_at, COUNT(DISTINCT l.user_id)::int AS like_count,
        COUNT(DISTINCT v.viewer_id)::int AS view_count, COUNT(DISTINCT c.id)::int AS comment_count,
        COUNT(DISTINCT r.user_id)::int AS repost_count,
        COALESCE(BOOL_OR(l.user_id = ${session.userId}), false) AS liked,
        COALESCE(BOOL_OR(r.user_id = ${session.userId}), false) AS reposted,
        COALESCE(BOOL_OR(b.user_id = ${session.userId}), false) AS bookmarked
        FROM creator_posts p
        LEFT JOIN creator_post_likes l ON l.post_id = p.id
        LEFT JOIN creator_post_views v ON v.post_id = p.id
        LEFT JOIN creator_post_comments c ON c.post_id = p.id
        LEFT JOIN creator_post_reposts r ON r.post_id = p.id
        LEFT JOIN creator_post_bookmarks b ON b.post_id = p.id
        WHERE p.user_id = ${session.userId}
        GROUP BY p.id ORDER BY p.created_at DESC LIMIT 50`,
      sql`SELECT c.id, c.body, c.created_at, p.id AS post_id, p.body AS post_body,
        u.full_name AS post_author
        FROM creator_post_comments c JOIN creator_posts p ON p.id = c.post_id
        JOIN users u ON u.id = p.user_id
        WHERE c.user_id = ${session.userId} ORDER BY c.created_at DESC LIMIT 50`,
      sql`SELECT r.created_at, p.id AS post_id, p.body AS post_body, u.full_name AS post_author
        FROM creator_post_reposts r JOIN creator_posts p ON p.id = r.post_id
        JOIN users u ON u.id = p.user_id
        WHERE r.user_id = ${session.userId} ORDER BY r.created_at DESC LIMIT 50`,
    ]);

    if (userRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = userRows[0];
    return NextResponse.json({
      profile: {
        ...user,
        level: displayLevel(user.level),
        creator_follower_count: Number(creatorCounts[0]?.followers ?? 0),
        creator_following_count: Number(creatorCounts[0]?.following ?? 0),
        creator_posts: creatorPosts.map((post) => ({ ...post, id: Number(post.id), like_count: Number(post.like_count), view_count: Number(post.view_count), comment_count: Number(post.comment_count), repost_count: Number(post.repost_count), liked: Boolean(post.liked), reposted: Boolean(post.reposted), bookmarked: Boolean(post.bookmarked) })),
        creator_replies: creatorReplies.map((reply) => ({ ...reply, id: Number(reply.id), post_id: Number(reply.post_id) })),
        creator_reposts: creatorReposts.map((repost) => ({ ...repost, post_id: Number(repost.post_id) })),
        tasks_completed:   taskRows[0]?.total ?? 0,
        tasks_today:       taskRows[0]?.today ?? 0,
        total_earned:      earnRows[0]?.total ?? 0,
        total_withdrawn:   withdrawRows[0]?.total ?? 0,
        referral_count:    referralRows[0]?.count ?? 0,
        milestones_claimed: milestoneRows[0]?.count ?? 0,
      },
    });
  } catch (err) {
    console.error("Profile GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (body.action === "update_profile") {
      const { full_name, phone, bio = "", website = "", location = "", occupation = "" } = body;
      if (!full_name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if ([bio, website, location, occupation].some((value) => typeof value !== "string")) return NextResponse.json({ error: "Profile details must be text." }, { status: 400 });
      if (bio.length > 280 || website.length > 200 || location.length > 80 || occupation.length > 100) return NextResponse.json({ error: "One or more profile fields exceed the allowed length." }, { status: 400 });
      await ensureCreatorSchema();
      await sql`UPDATE users SET full_name = ${full_name.trim()}, phone = ${phone || null}, bio = ${bio.trim()}, website = ${website.trim() || null}, location = ${location.trim() || null}, occupation = ${occupation.trim() || null} WHERE id = ${session.userId}`;
      return NextResponse.json({ ok: true });
    }

    if (body.action === "change_password") {
      const { current_password, new_password } = body;
      if (!current_password || !new_password) return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
      if (new_password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

      const rows = await sql`SELECT password FROM users WHERE id = ${session.userId}`;
      const valid = await bcrypt.compare(current_password, rows[0].password);
      if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });

      const hashed = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password = ${hashed} WHERE id = ${session.userId}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
