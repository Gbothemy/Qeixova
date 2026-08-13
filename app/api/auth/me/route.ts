import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { displayLevel } from "@/lib/levels";
import { WITHDRAWAL_UNLOCK_LEVEL, WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await sql`
    SELECT
      u.id, u.email, u.full_name, u.balance, u.streak, u.referral_code,
      u.trust_score, u.daily_earned, u.approved_count, u.rejected_count,
      u.total_earned_qlt, u.bonus_earned_qlt, u.created_at,
      l.level_number, l.name AS level_name, l.badge_color, l.badge_emoji,
      l.daily_cap_qlt, l.min_qlt, l.max_qlt, l.unlock_features
    FROM users u
    LEFT JOIN levels l ON l.id = u.level_id
    WHERE u.id = ${session.userId}
  `;
  if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const user = rows[0];
  const totalEarned = Number(user.total_earned_qlt ?? 0);
  const levelNumber = displayLevel(user.level_number);

  // Next level info
  const nextLevelRows = await sql`
    SELECT level_number, name, min_qlt, badge_emoji
    FROM levels
    WHERE level_number = ${levelNumber + 1}
    LIMIT 1
  `;
  const nextLevel = nextLevelRows[0] ?? null;

  // Progress toward next level
  const currentMin = Number(user.min_qlt ?? 0);
  const nextMin = nextLevel ? Number(nextLevel.min_qlt) : null;
  const progressPct = nextMin
    ? Math.min(100, Math.round(((totalEarned - currentMin) / (nextMin - currentMin)) * 100))
    : 100;
  const qltToNextLevel = nextMin ? Math.max(0, nextMin - totalEarned) : 0;

  // Withdrawal eligibility
  const canWithdraw = levelNumber >= WITHDRAWAL_UNLOCK_LEVEL && totalEarned >= WITHDRAWAL_UNLOCK_QLT;

  // Milestones claimed
  const milestoneRows = await sql`SELECT COUNT(*)::int AS claimed FROM user_milestones WHERE user_id = ${session.userId}`;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      balance: user.balance,
      streak: user.streak ?? 0,
      referral_code: user.referral_code,
      trust_score: user.trust_score ?? 100,
      daily_earned: user.daily_earned ?? 0,
      approved_count: user.approved_count ?? 0,
      rejected_count: user.rejected_count ?? 0,
      total_earned_qlt: totalEarned,
      bonus_earned_qlt: Number(user.bonus_earned_qlt ?? 0),
      // Level info
      level: levelNumber,
      levelName: user.level_name ?? "Starter",
      badgeColor: user.badge_color ?? "#1AEF22",
      badgeEmoji: user.badge_emoji ?? "🟢",
      dailyCap: user.daily_cap_qlt ?? 10000,
      unlockFeatures: user.unlock_features ?? ["open_missions"],
      // Progress
      progressPct,
      qltToNextLevel,
      nextLevel: nextLevel ? {
        number: nextLevel.level_number,
        name: nextLevel.name,
        minQlt: nextLevel.min_qlt,
        emoji: nextLevel.badge_emoji,
      } : null,
      canWithdraw,
      milestonesClaimed: milestoneRows[0]?.claimed ?? 0,
    },
  });
}
