/**
 * Mission Engine — QLT-based level progression
 * Levels and withdrawals use approved mission QLT only.
 * Bonus QLT is tracked separately and never advances mission progression.
 */
import { sql } from "@/lib/db";
import { WITHDRAWAL_UNLOCK_LEVEL, WITHDRAWAL_UNLOCK_QLT } from "@/lib/rewardRules";

export const QLT_PROGRESS_REWARDS: Record<string, number> = {
  engagement: 0, participation: 0, premium: 0,
};

// ── Get level for a given lifetime QLT amount ────────────────────────────────
export async function getLevelForQLT(totalEarnedQLT: number): Promise<{
  id: number; level_number: number; name: string;
  daily_cap_qlt: number; badge_color: string; badge_emoji: string;
  min_qlt: number; max_qlt: number | null;
}> {
  const rows = await sql`
    SELECT id, level_number, name, daily_cap_qlt, badge_color, badge_emoji, min_qlt, max_qlt
    FROM levels
    WHERE min_qlt <= ${totalEarnedQLT}
    ORDER BY min_qlt DESC
    LIMIT 1
  `;
  return (rows[0] as typeof rows[0] & { id: number; level_number: number; name: string; daily_cap_qlt: number; badge_color: string; badge_emoji: string; min_qlt: number; max_qlt: number | null }) ?? {
    id: 1, level_number: 0, name: "Starter", daily_cap_qlt: 10000,
    badge_color: "#1AEF22", badge_emoji: "🟢", min_qlt: 0, max_qlt: 50000,
  };
}

// ── Credit QLT and update level ───────────────────────────────────────────────
export async function creditQLTAndUpdateLevel(
  userId: number,
  amount: number,
): Promise<{ newTotalEarned: number; newLevel: number; leveledUp: boolean; levelName: string; badgeEmoji: string }> {
  const before = await sql`SELECT total_earned_qlt, level_id FROM users WHERE id = ${userId}`;
  const oldTotalEarned = Number(before[0]?.total_earned_qlt ?? 0);
  const oldLevelId = Number(before[0]?.level_id ?? 1);

  const newTotalEarned = oldTotalEarned + amount;

  // Get current trust score — trust gate for leveling up
  const trustRows = await sql`SELECT trust_score FROM users WHERE id = ${userId}`;
  const trustScore = Number(trustRows[0]?.trust_score ?? 100);

  // Find new level — trust must be >= 40 to go above Starter
  let newLevel = await getLevelForQLT(newTotalEarned);
  if (newLevel.level_number > 0 && trustScore < 40) {
    // Trust too low — cap at Starter
    const starterRows = await sql`SELECT id, level_number, name, daily_cap_qlt, badge_color, badge_emoji, min_qlt, max_qlt FROM levels WHERE level_number = 0 LIMIT 1`;
    if (starterRows.length > 0) newLevel = starterRows[0] as typeof newLevel;
  }

  await sql`
    UPDATE users
    SET total_earned_qlt = ${newTotalEarned},
        level_id = ${newLevel.id}
    WHERE id = ${userId}
  `;

  return {
    newTotalEarned,
    newLevel: newLevel.level_number,
    leveledUp: newLevel.id !== oldLevelId,
    levelName: newLevel.name,
    badgeEmoji: newLevel.badge_emoji,
  };
}

// ── Check if user can withdraw ────────────────────────────────────────────────
export async function canWithdraw(userId: number): Promise<{
  allowed: boolean; totalEarned: number; needed: number; levelName: string;
}> {
  const rows = await sql`
    SELECT u.total_earned_qlt, l.level_number, l.name
    FROM users u
    LEFT JOIN levels l ON l.id = u.level_id
    WHERE u.id = ${userId}
  `;
  const user = rows[0];
  const totalEarned = Number(user?.total_earned_qlt ?? 0);
  const levelNumber = Number(user?.level_number ?? 0);
  const allowed = levelNumber >= WITHDRAWAL_UNLOCK_LEVEL && totalEarned >= WITHDRAWAL_UNLOCK_QLT;
  const needed = Math.max(0, WITHDRAWAL_UNLOCK_QLT - totalEarned);

  return { allowed, totalEarned, needed, levelName: user?.name ?? "Starter" };
}

// ── Check + enforce daily earning cap ────────────────────────────────────────
export async function checkDailyCap(userId: number, rewardAmount: number): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split("T")[0];

  await sql`
    UPDATE users
    SET daily_earned = 0, daily_reset_at = ${today}
    WHERE id = ${userId} AND daily_reset_at < ${today}
  `;

  const rows = await sql`
    SELECT u.daily_earned, l.daily_cap_qlt
    FROM users u
    JOIN levels l ON l.id = u.level_id
    WHERE u.id = ${userId}
  `;

  const { daily_earned, daily_cap_qlt } = rows[0];
  const remaining = Math.max(0, daily_cap_qlt - Number(daily_earned));
  return { allowed: remaining >= rewardAmount, remaining };
}

// ── Update streak ─────────────────────────────────────────────────────────────
export async function updateStreak(userId: number): Promise<{ newStreak: number }> {
  const rows = await sql`
    UPDATE users
    SET streak = CASE
          WHEN last_active = CURRENT_DATE THEN streak
          WHEN last_active = CURRENT_DATE - 1 THEN streak + 1
          ELSE 1
        END,
        last_active = CURRENT_DATE
    WHERE id = ${userId}
    RETURNING streak
  `;

  return { newStreak: Number(rows[0]?.streak ?? 1) };
}

// ── Milestone schema/integrity ────────────────────────────────────────────────
export async function ensureMilestoneIntegrity(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS milestones (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      trigger_type    TEXT NOT NULL,
      trigger_value   INT NOT NULL,
      bonus_qlt       INT NOT NULL DEFAULT 0,
      bonus_xp        INT NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_milestones (
      id           SERIAL PRIMARY KEY,
      user_id      INT NOT NULL REFERENCES users(id),
      milestone_id INT NOT NULL REFERENCES milestones(id),
      claimed_at   TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, milestone_id)
    )
  `;

  await sql`
    DELETE FROM user_milestones um
    USING user_milestones keep
    WHERE um.user_id = keep.user_id
      AND um.milestone_id = keep.milestone_id
      AND um.id > keep.id
  `;

  await sql`
    WITH duplicate_milestones AS (
      SELECT
        id,
        MIN(id) OVER (
          PARTITION BY name, trigger_type, trigger_value, bonus_qlt, bonus_xp
        ) AS canonical_id
      FROM milestones
    ),
    moved_claims AS (
      INSERT INTO user_milestones (user_id, milestone_id, claimed_at)
      SELECT um.user_id, dm.canonical_id, MIN(um.claimed_at)
      FROM user_milestones um
      JOIN duplicate_milestones dm ON dm.id = um.milestone_id
      WHERE dm.id <> dm.canonical_id
        AND NOT EXISTS (
          SELECT 1 FROM user_milestones existing
          WHERE existing.user_id = um.user_id
            AND existing.milestone_id = dm.canonical_id
        )
      GROUP BY um.user_id, dm.canonical_id
      RETURNING id
    ),
    deleted_claims AS (
      DELETE FROM user_milestones um
      USING duplicate_milestones dm
      WHERE um.milestone_id = dm.id
        AND dm.id <> dm.canonical_id
      RETURNING um.id
    )
    DELETE FROM milestones m
    USING duplicate_milestones dm
    WHERE m.id = dm.id
      AND dm.id <> dm.canonical_id
  `;

  await sql`
    DELETE FROM user_milestones um
    USING user_milestones keep
    WHERE um.user_id = keep.user_id
      AND um.milestone_id = keep.milestone_id
      AND um.id > keep.id
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS milestones_unique_definition_idx
    ON milestones (name, trigger_type, trigger_value, bonus_qlt, bonus_xp)
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_milestones_user_milestone_idx
    ON user_milestones (user_id, milestone_id)
  `;
}

// ── Check and award milestones ────────────────────────────────────────────────
export async function checkMilestones(userId: number): Promise<{ awarded: Array<{ name: string; bonus_qlt: number }> }> {
  const awarded: Array<{ name: string; bonus_qlt: number }> = [];
  await ensureMilestoneIntegrity();

  const userRows = await sql`SELECT total_earned_qlt, streak FROM users WHERE id = ${userId}`;
  const user = userRows[0];
  if (!user) return { awarded };

  const totalCompletions = await sql`
    SELECT COUNT(*)::int AS total FROM completions WHERE user_id = ${userId} AND status = 'approved'
  `;
  const total = totalCompletions[0].total;

  const milestones = await sql`
    SELECT m.* FROM milestones m
    WHERE NOT EXISTS (
      SELECT 1 FROM user_milestones um WHERE um.user_id = ${userId} AND um.milestone_id = m.id
    )
  `;

  for (const m of milestones) {
    let triggered = false;
    if (m.trigger_type === 'total_completions' && total >= m.trigger_value) triggered = true;
    if (m.trigger_type === 'streak' && user.streak >= m.trigger_value) triggered = true;
    if (m.trigger_type === 'total_xp' && user.total_earned_qlt >= m.trigger_value) triggered = true;

    if (triggered) {
      const claimed = await sql`
        INSERT INTO user_milestones (user_id, milestone_id)
        VALUES (${userId}, ${m.id})
        ON CONFLICT (user_id, milestone_id) DO NOTHING
        RETURNING id
      `;
      if (claimed.length === 0) continue;

      if (m.bonus_qlt > 0) {
        await sql`
          UPDATE users
          SET balance = balance + ${m.bonus_qlt},
              bonus_earned_qlt = bonus_earned_qlt + ${m.bonus_qlt}
          WHERE id = ${userId}
        `;
        await sql`INSERT INTO transactions (user_id, type, amount, label) VALUES (${userId}, 'credit', ${m.bonus_qlt}, ${'Milestone: ' + m.name})`;
      }

      awarded.push({ name: m.name, bonus_qlt: m.bonus_qlt });
    }
  }

  return { awarded };
}

// ── Update trust score ────────────────────────────────────────────────────────
export async function updateTrustScore(userId: number): Promise<{ trustScore: number }> {
  const rows = await sql`SELECT approved_count, rejected_count FROM users WHERE id = ${userId}`;
  const { approved_count, rejected_count } = rows[0];
  const total = (approved_count ?? 0) + (rejected_count ?? 0);

  let trustScore = 100;
  if (total >= 3) {
    trustScore = Math.round(((approved_count ?? 0) / total) * 100);
  }

  await sql`UPDATE users SET trust_score = ${trustScore} WHERE id = ${userId}`;
  return { trustScore };
}

// Keep awardXP as a no-op for backward compatibility with legacy callers.
export async function awardXP(userId: number): Promise<{ newXP: number; newLevel: number; leveledUp: boolean }> {
  const rows = await sql`SELECT level_id FROM users WHERE id = ${userId}`;
  const levelRows = await sql`SELECT level_number FROM levels WHERE id = ${rows[0]?.level_id ?? 1} LIMIT 1`;
  return { newXP: 0, newLevel: levelRows[0]?.level_number ?? 0, leveledUp: false };
}
