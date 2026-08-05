import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page   = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit  = 20;
  const offset = (page - 1) * limit;
  const q = "%" + search + "%";

  const [users, countRows] = await Promise.all([
    search
      ? sql`
          WITH accounts AS (
            SELECT 'contributor' AS account_type, u.id, u.full_name, u.email, u.balance, u.created_at, u.banned,
              NULL::text AS status, NULL::text AS industry, NULL::text AS website,
              u.xp, u.trust_score, u.streak, u.approved_count, u.rejected_count,
              u.interests, u.platforms, u.state, u.age_range, u.gender, u.onboarding_completed,
              l.level_number, l.name AS level_name, l.badge_color,
              COUNT(c.id)::int AS tasks_completed, 0::int AS campaign_count
            FROM users u
            LEFT JOIN completions c ON c.user_id = u.id AND c.status = 'approved'
            LEFT JOIN levels l ON l.id = u.level_id
            WHERE u.full_name ILIKE ${q} OR u.email ILIKE ${q}
            GROUP BY u.id, l.level_number, l.name, l.badge_color
            UNION ALL
            SELECT 'business' AS account_type, b.id, b.name AS full_name, b.email, b.balance, b.created_at,
              (COALESCE(b.status, 'active') <> 'active') AS banned,
              COALESCE(b.status, 'active') AS status, b.industry, b.website,
              0::int AS xp, NULL::int AS trust_score, 0::int AS streak, 0::int AS approved_count, 0::int AS rejected_count,
              ARRAY[]::text[] AS interests, ARRAY[]::text[] AS platforms, NULL::text AS state,
              NULL::text AS age_range, NULL::text AS gender, NULL::boolean AS onboarding_completed,
              NULL::int AS level_number, NULL::text AS level_name, NULL::text AS badge_color,
              0::int AS tasks_completed, COUNT(t.id)::int AS campaign_count
            FROM businesses b
            LEFT JOIN tasks t ON t.business_id = b.id
            WHERE b.name ILIKE ${q} OR b.email ILIKE ${q} OR COALESCE(b.industry, '') ILIKE ${q}
            GROUP BY b.id
          )
          SELECT * FROM accounts
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : sql`
          WITH accounts AS (
            SELECT 'contributor' AS account_type, u.id, u.full_name, u.email, u.balance, u.created_at, u.banned,
              NULL::text AS status, NULL::text AS industry, NULL::text AS website,
              u.xp, u.trust_score, u.streak, u.approved_count, u.rejected_count,
              u.interests, u.platforms, u.state, u.age_range, u.gender, u.onboarding_completed,
              l.level_number, l.name AS level_name, l.badge_color,
              COUNT(c.id)::int AS tasks_completed, 0::int AS campaign_count
            FROM users u
            LEFT JOIN completions c ON c.user_id = u.id AND c.status = 'approved'
            LEFT JOIN levels l ON l.id = u.level_id
            GROUP BY u.id, l.level_number, l.name, l.badge_color
            UNION ALL
            SELECT 'business' AS account_type, b.id, b.name AS full_name, b.email, b.balance, b.created_at,
              (COALESCE(b.status, 'active') <> 'active') AS banned,
              COALESCE(b.status, 'active') AS status, b.industry, b.website,
              0::int AS xp, NULL::int AS trust_score, 0::int AS streak, 0::int AS approved_count, 0::int AS rejected_count,
              ARRAY[]::text[] AS interests, ARRAY[]::text[] AS platforms, NULL::text AS state,
              NULL::text AS age_range, NULL::text AS gender, NULL::boolean AS onboarding_completed,
              NULL::int AS level_number, NULL::text AS level_name, NULL::text AS badge_color,
              0::int AS tasks_completed, COUNT(t.id)::int AS campaign_count
            FROM businesses b
            LEFT JOIN tasks t ON t.business_id = b.id
            GROUP BY b.id
          )
          SELECT * FROM accounts
          ORDER BY created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
    search
      ? sql`
          SELECT (
            (SELECT COUNT(*)::int FROM users WHERE full_name ILIKE ${q} OR email ILIKE ${q}) +
            (SELECT COUNT(*)::int FROM businesses WHERE name ILIKE ${q} OR email ILIKE ${q} OR COALESCE(industry, '') ILIKE ${q})
          )::int AS total
        `
      : sql`SELECT ((SELECT COUNT(*)::int FROM users) + (SELECT COUNT(*)::int FROM businesses))::int AS total`,
  ]);

  return NextResponse.json({ users, total: countRows[0].total });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action, value } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  if (action === "ban") {
    await sql`UPDATE users SET banned = TRUE WHERE id = ${id}`;
  } else if (action === "unban") {
    await sql`UPDATE users SET banned = FALSE WHERE id = ${id}`;
  } else if (action === "suspend_business") {
    await sql`UPDATE businesses SET status = 'suspended' WHERE id = ${id}`;
  } else if (action === "activate_business") {
    await sql`UPDATE businesses SET status = 'active' WHERE id = ${id}`;
  } else if (action === "set_trust_score") {
    const score = Math.max(0, Math.min(100, Number(value)));
    await sql`UPDATE users SET trust_score = ${score} WHERE id = ${id}`;
  } else if (action === "set_level") {
    const levelRows = await sql`SELECT id FROM levels WHERE level_number = ${Number(value)} LIMIT 1`;
    if (levelRows.length > 0) {
      await sql`UPDATE users SET level_id = ${levelRows[0].id} WHERE id = ${id}`;
    }
  } else if (action === "reset_trust") {
    await sql`UPDATE users SET trust_score = 100, approved_count = 0, rejected_count = 0 WHERE id = ${id}`;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
