import { sql } from "@/lib/db";

export type ContributorNotificationType =
  | "task_available"
  | "growth_activity"
  | "submission_received"
  | "submission_approved"
  | "submission_rejected"
  | "reward_credited"
  | "withdrawal_update"
  | "account_update"
  | "announcement"
  | "task_reminder";

type CreateContributorNotificationInput = {
  userId: number;
  type: ContributorNotificationType;
  title: string;
  message: string;
  href?: string | null;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
};

export async function ensureContributorNotificationsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS contributor_notifications (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      href TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      dedupe_key TEXT,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS contributor_notifications_user_dedupe_idx
    ON contributor_notifications(user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS contributor_notifications_user_created_idx
    ON contributor_notifications(user_id, created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS contributor_notifications_unread_idx
    ON contributor_notifications(user_id, read_at)
  `;
}

export async function createContributorNotification(input: CreateContributorNotificationInput) {
  await ensureContributorNotificationsTable();

  if (input.dedupeKey) {
    await sql`
      INSERT INTO contributor_notifications (user_id, type, title, message, href, metadata, dedupe_key)
      VALUES (
        ${input.userId},
        ${input.type},
        ${input.title},
        ${input.message},
        ${input.href ?? null},
        ${JSON.stringify(input.metadata ?? {})},
        ${input.dedupeKey}
      )
      ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    `;
    return;
  }

  await sql`
    INSERT INTO contributor_notifications (user_id, type, title, message, href, metadata)
    VALUES (
      ${input.userId},
      ${input.type},
      ${input.title},
      ${input.message},
      ${input.href ?? null},
      ${JSON.stringify(input.metadata ?? {})}
    )
  `;
}

export async function seedContributorTaskNotifications(userId: number) {
  await ensureContributorNotificationsTable();

  const userRows = await sql`
    SELECT state, interests
    FROM users
    WHERE id = ${userId}
  `;
  const user = userRows[0];
  if (!user) return;

  const state = String(user.state ?? "").trim();
  const interests = Array.isArray(user.interests)
    ? user.interests.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  const tasks = await sql`
    SELECT id, title, reward, created_at
    FROM tasks
    WHERE (
        is_active = true
        OR COALESCE(campaign_status, '') = 'live'
      )
      AND COALESCE(task_status, 'active') = 'active'
      AND COALESCE(campaign_status, '') NOT IN ('pending_review', 'rejected', 'closed')
      AND (total_budget = 0 OR budget_used < total_budget)
      AND NOT EXISTS (
        SELECT 1 FROM completions c
        WHERE c.task_id = tasks.id AND c.user_id = ${userId}
      )
      AND (
        CARDINALITY(COALESCE(target_states, '{}')) = 0
        OR ${state} = ANY(target_states)
      )
      AND (
        CARDINALITY(COALESCE(target_interests, '{}')) = 0
        OR target_interests && ${interests}
      )
    ORDER BY created_at DESC
    LIMIT 3
  `;

  for (const task of tasks) {
    await createContributorNotification({
      userId,
      type: "task_available",
      title: "New mission available",
      message: `${task.title} matches your profile and pays ${Number(task.reward ?? 0).toLocaleString()} QLT.`,
      href: "/tasks",
      dedupeKey: `task:${task.id}`,
      metadata: { taskId: Number(task.id), reward: Number(task.reward ?? 0) },
    });
  }
}
