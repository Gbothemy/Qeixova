import { sql } from "@/lib/db";
import { refundUnusedCampaignBudget } from "@/lib/campaignBudgetRefund";
import { createBusinessNotification } from "@/lib/businessNotifications";

const DEFAULT_CAMPAIGN_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

export function parseMissionDurationMs(duration: unknown) {
  const value = String(duration ?? "").trim().toLowerCase();
  const match = value.match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week|month)s?/i);
  if (!match) return DEFAULT_CAMPAIGN_DURATION_MS;

  const amount = Math.max(0, Number(match[1]) || 0);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    minute: 60 * 1000,
    min: 60 * 1000,
    hour: 60 * 60 * 1000,
    hr: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  return Math.max(60 * 60 * 1000, Math.round(amount * (multipliers[unit] ?? DEFAULT_CAMPAIGN_DURATION_MS)));
}

export function calculateMissionExpiry(duration: unknown, start = new Date()) {
  return new Date(start.getTime() + parseMissionDurationMs(duration));
}

export async function ensureMissionExpiryColumns() {
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS tasks_expires_at_idx ON tasks (expires_at)`;
}

async function tableExists(tableName: string) {
  const rows = await sql`SELECT to_regclass(${`public.${tableName}`}) AS table_name`;
  return Boolean(rows[0]?.table_name);
}

export async function activateMissionExpiryByTask(taskId: number) {
  await ensureMissionExpiryColumns();
  const rows = await sql`SELECT id, duration, approved_at, expires_at FROM tasks WHERE id = ${taskId} LIMIT 1`;
  if (rows.length === 0) return null;

  const now = new Date();
  const existingExpiry = rows[0].expires_at ? new Date(rows[0].expires_at) : null;
  const hasUsableExpiry = Boolean(existingExpiry && !Number.isNaN(existingExpiry.getTime()) && existingExpiry > now);
  const startedAt = hasUsableExpiry ? new Date(rows[0].approved_at || now) : now;
  const expiresAt = hasUsableExpiry && existingExpiry ? existingExpiry : calculateMissionExpiry(rows[0].duration, startedAt);

  if (!hasUsableExpiry) {
    await sql`
      UPDATE tasks
      SET approved_at = ${startedAt.toISOString()}::timestamptz,
          expires_at = ${expiresAt.toISOString()}::timestamptz,
          campaign_metadata = COALESCE(campaign_metadata, '{}'::jsonb)
            || ${JSON.stringify({
              approvedAt: startedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
              durationSource: rows[0].duration,
              renewedAfterExpiry: Boolean(existingExpiry),
            })}::jsonb
      WHERE id = ${taskId}
    `;
  }

  const hasCampaigns = await tableExists("campaigns");
  const hasCampaignTimers = await tableExists("campaign_timers");

  if (hasCampaigns) {
    await sql`
      UPDATE campaigns
      SET start_date = ${startedAt.toISOString()}::timestamptz,
          end_date = ${expiresAt.toISOString()}::timestamptz,
          updated_at = NOW()
      WHERE task_id = ${taskId}
    `;
  }

  if (hasCampaigns && hasCampaignTimers) {
    await sql`
      UPDATE campaign_timers
      SET campaign_expiry_at = ${expiresAt.toISOString()}::timestamptz,
          updated_at = NOW()
      WHERE campaign_id = (SELECT id FROM campaigns WHERE task_id = ${taskId} LIMIT 1)
    `;
  }

  return { startedAt, expiresAt };
}

async function backfillMissingMissionExpiries() {
  const hasCampaigns = await tableExists("campaigns");
  const hasCampaignTimers = await tableExists("campaign_timers");

  if (!hasCampaigns) return;

  const rows = await sql`
    SELECT
      t.id,
      t.duration,
      t.created_at,
      t.approved_at,
      c.id AS campaign_id,
      c.start_date
    FROM tasks t
    LEFT JOIN campaigns c ON c.task_id = t.id
    WHERE t.expires_at IS NULL
      AND (
        (t.is_active = TRUE AND COALESCE(t.task_status, 'active') = 'active')
        OR COALESCE(t.campaign_status, '') = 'live'
        OR COALESCE(c.status, '') = 'live'
      )
      AND COALESCE(t.task_status, '') NOT IN ('deleted', 'rejected', 'closed', 'expired')
    LIMIT 200
  `;

  for (const row of rows) {
    const startedAt = new Date(row.approved_at || row.start_date || row.created_at || Date.now());
    const expiresAt = calculateMissionExpiry(row.duration, startedAt);
    await sql`
      UPDATE tasks
      SET approved_at = COALESCE(approved_at, ${startedAt.toISOString()}::timestamptz),
          expires_at = ${expiresAt.toISOString()}::timestamptz,
          campaign_metadata = COALESCE(campaign_metadata, '{}'::jsonb)
            || ${JSON.stringify({
              backfilledExpiry: true,
              approvedAt: startedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
              durationSource: row.duration,
            })}::jsonb
      WHERE id = ${row.id}
    `;

    if (row.campaign_id) {
      await sql`
        UPDATE campaigns
        SET start_date = COALESCE(start_date, ${startedAt.toISOString()}::timestamptz),
            end_date = COALESCE(end_date, ${expiresAt.toISOString()}::timestamptz),
            updated_at = NOW()
        WHERE id = ${row.campaign_id}
      `;
      if (hasCampaignTimers) {
        await sql`
          UPDATE campaign_timers
          SET campaign_expiry_at = ${expiresAt.toISOString()}::timestamptz,
              updated_at = NOW()
          WHERE campaign_id = ${row.campaign_id}
        `;
      }
    }
  }
}

export async function expireElapsedMissions() {
  await ensureMissionExpiryColumns();
  await backfillMissingMissionExpiries();

  const expired = await sql`
    UPDATE tasks
    SET is_active = FALSE,
        task_status = 'expired',
        campaign_status = 'expired',
        campaign_metadata = COALESCE(campaign_metadata, '{}'::jsonb)
          || jsonb_build_object('expiredAt', NOW())
    WHERE expires_at IS NOT NULL
      AND expires_at <= NOW()
      AND COALESCE(task_status, 'active') NOT IN ('expired', 'closed', 'deleted', 'rejected')
    RETURNING id
  `;

  if (await tableExists("campaigns")) {
    await sql`
      UPDATE campaigns c
      SET status = 'live',
          start_date = COALESCE(c.start_date, t.approved_at),
          end_date = t.expires_at,
          updated_at = NOW()
      FROM tasks t
      WHERE c.task_id = t.id
        AND t.is_active = TRUE
        AND COALESCE(t.task_status, '') = 'active'
        AND t.expires_at IS NOT NULL
        AND t.expires_at > NOW()
        AND COALESCE(c.status, '') = 'expired'
    `;
    await sql`
      UPDATE campaigns
      SET status = 'expired',
          updated_at = NOW()
      WHERE task_id IN (SELECT id FROM tasks WHERE COALESCE(task_status, '') = 'expired')
        AND COALESCE(status, '') NOT IN ('expired', 'closed', 'rejected')
    `;

    const expiredCampaigns = await sql`
      SELECT c.id, c.business_id, c.task_id, c.title
      FROM campaigns c
      JOIN tasks t ON t.id = c.task_id
      WHERE COALESCE(c.status, '') = 'expired'
        AND COALESCE(t.task_status, '') = 'expired'
      ORDER BY c.updated_at DESC
      LIMIT 200
    `;
    for (const campaign of expiredCampaigns) {
      const refund = await refundUnusedCampaignBudget({
        campaignId: Number(campaign.id),
        businessId: Number(campaign.business_id),
        reason: "campaign_expired",
      });
      if (refund.refunded > 0) {
        await createBusinessNotification({
          businessId: Number(campaign.business_id),
          type: "wallet",
          tone: "green",
          title: "Unused campaign reserve returned",
          body: `${refund.refunded.toLocaleString()} QLT from ${campaign.title} was returned to your available balance after the campaign expired.`,
          status: "Refunded",
          href: "/business/wallet",
          metadata: { campaignId: campaign.id, taskId: campaign.task_id, amount: refund.refunded },
        });
      }
    }
  }

  return expired.length;
}
