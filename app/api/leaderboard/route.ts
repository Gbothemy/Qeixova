import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [topEarners, topQLT, monthlyRankRows, allTimeRankRows] = await Promise.all([
    sql`
      WITH monthly AS (
        SELECT
          u.id,
          u.full_name,
          u.created_at,
          GREATEST(1, COALESCE(l.level_number, u.level, 1))::int AS level_number,
          COALESCE(l.name, 'Starter') AS level_name,
          COALESCE(l.badge_color, '#1AEF22') AS badge_color,
          u.xp,
          u.streak,
          COUNT(c.id)::int AS missions_completed,
          COALESCE(SUM(c.qlt_awarded), 0)::int AS total_qlt_earned
        FROM users u
        LEFT JOIN completions c
          ON c.user_id = u.id
          AND c.status = 'approved'
          AND c.completed_at >= date_trunc('month', NOW())
        LEFT JOIN levels l ON l.id = u.level_id
        GROUP BY u.id, l.level_number, l.name, l.badge_color
      ), ranked AS (
        SELECT monthly.*,
          ROW_NUMBER() OVER (
            ORDER BY missions_completed DESC, total_qlt_earned DESC, created_at ASC, id ASC
          )::int AS rank
        FROM monthly
      )
      SELECT * FROM ranked
      ORDER BY rank
      LIMIT 10
    `,
    sql`
      WITH lifetime AS (
        SELECT
          u.id,
          u.full_name,
          u.created_at,
          GREATEST(1, COALESCE(l.level_number, u.level, 1))::int AS level_number,
          COALESCE(l.name, 'Starter') AS level_name,
          COALESCE(l.badge_color, '#1AEF22') AS badge_color,
          u.xp,
          u.streak,
          COALESCE(u.total_earned_qlt, 0)::bigint AS total_qlt_earned,
          COUNT(c.id)::int AS missions_completed
        FROM users u
        LEFT JOIN completions c ON c.user_id = u.id AND c.status = 'approved'
        LEFT JOIN levels l ON l.id = u.level_id
        GROUP BY u.id, l.level_number, l.name, l.badge_color
      ), ranked AS (
        SELECT lifetime.*,
          ROW_NUMBER() OVER (
            ORDER BY total_qlt_earned DESC, missions_completed DESC, created_at ASC, id ASC
          )::int AS rank
        FROM lifetime
      )
      SELECT * FROM ranked
      ORDER BY rank
      LIMIT 10
    `,
    sql`
      WITH monthly AS (
        SELECT
          u.id,
          u.created_at,
          COUNT(c.id)::int AS missions_completed,
          COALESCE(SUM(c.qlt_awarded), 0)::int AS total_qlt_earned
        FROM users u
        LEFT JOIN completions c
          ON c.user_id = u.id
          AND c.status = 'approved'
          AND c.completed_at >= date_trunc('month', NOW())
        GROUP BY u.id
      ), ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            ORDER BY missions_completed DESC, total_qlt_earned DESC, created_at ASC, id ASC
          )::int AS rank
        FROM monthly
      )
      SELECT rank FROM ranked WHERE id = ${session.userId}
    `,
    sql`
      WITH lifetime AS (
        SELECT
          u.id,
          u.created_at,
          COALESCE(u.total_earned_qlt, 0)::bigint AS total_qlt_earned,
          COUNT(c.id)::int AS missions_completed
        FROM users u
        LEFT JOIN completions c ON c.user_id = u.id AND c.status = 'approved'
        GROUP BY u.id
      ), ranked AS (
        SELECT id,
          ROW_NUMBER() OVER (
            ORDER BY total_qlt_earned DESC, missions_completed DESC, created_at ASC, id ASC
          )::int AS rank
        FROM lifetime
      )
      SELECT rank FROM ranked WHERE id = ${session.userId}
    `,
  ]);

  const monthlyRank = Number(monthlyRankRows[0]?.rank) || null;
  const allTimeRank = Number(allTimeRankRows[0]?.rank) || null;

  return NextResponse.json({
    topEarners,
    topQLT,
    topXP: topQLT,
    myRank: monthlyRank,
    myRanks: { monthly: monthlyRank, allTime: allTimeRank },
  });
}
