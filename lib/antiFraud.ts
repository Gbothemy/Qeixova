import { sql } from "@/lib/db";

const MAX_SUBMISSIONS_PER_HOUR = 10;
export const MAX_MISSION_ATTEMPTS = 2;

export async function ensureCompletionAttemptSchema() {
  await sql`ALTER TABLE completions ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1`;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'completions_attempt_count_check') THEN
        ALTER TABLE completions
        ADD CONSTRAINT completions_attempt_count_check CHECK (attempt_count BETWEEN 1 AND 2);
      END IF;
    END $$
  `;
}

/**
 * Check if user has exceeded hourly submission limit.
 * Returns { allowed: boolean, remaining: number }
 */
export async function checkRateLimit(userId: number): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  // Reset hourly counter if window has passed
  await sql`
    UPDATE users
    SET hourly_submissions = 0, hourly_reset_at = NOW()
    WHERE id = ${userId}
      AND hourly_reset_at < ${windowStart.toISOString()}
  `;

  const rows = await sql`SELECT hourly_submissions FROM users WHERE id = ${userId}`;
  const count = Number(rows[0]?.hourly_submissions ?? 0);
  const remaining = Math.max(0, MAX_SUBMISSIONS_PER_HOUR - count);

  return { allowed: count < MAX_SUBMISSIONS_PER_HOUR, remaining };
}

/** Increment hourly submission counter */
export async function incrementRateLimit(userId: number): Promise<void> {
  await sql`UPDATE users SET hourly_submissions = hourly_submissions + 1 WHERE id = ${userId}`;
}

/**
 * Check if user's trust score is too low to submit.
 * Only enforced after minimum missions threshold.
 */
export async function checkTrustScore(userId: number): Promise<{ allowed: boolean; trustScore: number }> {
  const rows = await sql`
    SELECT trust_score, approved_count, rejected_count
    FROM users WHERE id = ${userId}
  `;
  const user = rows[0];
  const trustScore = Number(user?.trust_score ?? 100);
  const total = Number(user?.approved_count ?? 0) + Number(user?.rejected_count ?? 0);

  // Only enforce after 3+ reviewed missions
  if (total < 3) return { allowed: true, trustScore };

  // Block if trust score below 30 (very high rejection rate)
  return { allowed: trustScore >= 30, trustScore };
}

export async function getMissionAttemptState(userId: number, taskId: number) {
  const rows = await sql`
    SELECT id, status, attempt_count
    FROM completions
    WHERE user_id = ${userId} AND task_id = ${taskId}
    LIMIT 1
  `;
  if (rows.length === 0) {
    return { completionId: null, attemptCount: 0, canSubmit: true, isRetry: false, status: null };
  }

  const attemptCount = Number(rows[0].attempt_count ?? 1);
  const status = String(rows[0].status ?? "pending");
  const isRetry = status === "rejected" && attemptCount < MAX_MISSION_ATTEMPTS;
  return { completionId: Number(rows[0].id), attemptCount, canSubmit: isRetry, isRetry, status };
}
