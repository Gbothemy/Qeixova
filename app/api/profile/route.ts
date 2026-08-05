import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";
import { displayLevel } from "@/lib/levels";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [userRows, taskRows, earnRows, withdrawRows, referralRows, milestoneRows] = await Promise.all([
      sql`
        SELECT
          u.id, u.email, u.full_name, u.phone, u.balance, u.streak,
          COALESCE(l.level_number, u.level, 0) AS level,
          l.name AS level_name,
          l.badge_color,
          u.referral_code, u.created_at, u.trust_level, u.approved_count,
          u.rejected_count, u.trust_score, u.xp, u.total_earned_qlt
        FROM users u
        LEFT JOIN levels l ON l.id = u.level_id
        WHERE u.id = ${session.userId}
      `,

      // Total tasks completed — split into all-time and today
      sql`SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN DATE(completed_at) = CURRENT_DATE THEN 1 END)::int AS today
        FROM completions WHERE user_id = ${session.userId}`,

      // Total QLT accumulated (all credits)
      sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE user_id = ${session.userId} AND type = 'credit'`,

      // Total QLT withdrawn
      sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE user_id = ${session.userId} AND type = 'debit' AND status IN ('pending', 'processing', 'completed')`,

      // Referral count
      sql`SELECT COUNT(*)::int AS count FROM users WHERE referred_by = ${session.userId}`,

      // Milestone count
      sql`SELECT COUNT(*)::int AS count FROM user_milestones WHERE user_id = ${session.userId}`,
    ]);

    if (userRows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = userRows[0];
    return NextResponse.json({
      profile: {
        ...user,
        level: displayLevel(user.level),
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
      const { full_name, phone } = body;
      if (!full_name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      await sql`UPDATE users SET full_name = ${full_name.trim()}, phone = ${phone || null} WHERE id = ${session.userId}`;
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
