import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [
      userRows,
      txRows,
      todayTaskRows,
      todayEarnRows,
      totalTaskRows,
      totalEarnRows,
      withdrawnRows,
      pendingRows,
      rejectedRows,
    ] = await Promise.all([

      // Current balance
      sql`SELECT balance FROM users WHERE id = ${session.userId}`,

      // Recent transactions
      sql`
        SELECT type, label, amount, status, created_at
        FROM transactions
        WHERE user_id = ${session.userId}
        ORDER BY created_at DESC
        LIMIT 20
      `,

      // Tasks completed TODAY
      sql`
        SELECT COUNT(*)::int AS count
        FROM completions
        WHERE user_id = ${session.userId}
          AND DATE(completed_at) = CURRENT_DATE
      `,

      // QLT earned TODAY (task credits only)
      sql`
        SELECT COALESCE(SUM(amount), 0)::int AS total
        FROM transactions
        WHERE user_id = ${session.userId}
          AND type = 'credit'
          AND (label LIKE 'Task:%' OR label LIKE 'Mission Approved:%')
          AND DATE(created_at) = CURRENT_DATE
      `,

      // Total tasks completed ALL TIME
      sql`
        SELECT COUNT(*)::int AS count
        FROM completions
        WHERE user_id = ${session.userId}
      `,

      // Total QLT accumulated ALL TIME (all credits)
      sql`
        SELECT COALESCE(SUM(amount), 0)::int AS total
        FROM transactions
        WHERE user_id = ${session.userId}
          AND type = 'credit'
      `,

      // Total QLT withdrawn ALL TIME
      sql`
        SELECT COALESCE(SUM(amount), 0)::int AS total
        FROM transactions
        WHERE user_id = ${session.userId}
          AND type = 'debit'
          AND status IN ('pending', 'processing', 'completed')
      `,

      // Pending QLT (submitted but not yet approved)
      sql`
        SELECT COALESCE(SUM(t.reward), 0)::int AS total, COUNT(*)::int AS count
        FROM completions c
        JOIN tasks t ON t.id = c.task_id
        WHERE c.user_id = ${session.userId}
          AND c.status = 'pending'
      `,

      // Rejected completions (to show user)
      sql`
        SELECT c.rejection_reason, t.title, c.completed_at
        FROM completions c
        JOIN tasks t ON t.id = c.task_id
        WHERE c.user_id = ${session.userId}
          AND c.status = 'rejected'
        ORDER BY c.completed_at DESC
        LIMIT 5
      `,
    ]);

    return NextResponse.json({
      balance:           userRows[0]?.balance ?? 0,
      transactions:      txRows,
      pending_qlt:       pendingRows[0]?.total ?? 0,
      pending_count:     pendingRows[0]?.count ?? 0,
      rejected:          rejectedRows,
      stats: {
        tasks_today:       todayTaskRows[0]?.count ?? 0,
        today_earned:      todayEarnRows[0]?.total ?? 0,
        tasks_total:       totalTaskRows[0]?.count ?? 0,
        total_accumulated: totalEarnRows[0]?.total ?? 0,
        total_withdrawn:   withdrawnRows[0]?.total ?? 0,
      },
    });
  } catch (err) {
    console.error("Wallet API error:", err);
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }
}
