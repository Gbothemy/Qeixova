import { sql } from "@/lib/db";

export const PREMIUM_MONTHLY_PRICE_NAIRA = 5700;

export async function ensurePremiumSubscriptionTable() {
  await sql`CREATE TABLE IF NOT EXISTS contributor_premium_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'failed')),
    amount_naira INTEGER NOT NULL,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
    provider_transaction_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`ALTER TABLE contributor_premium_subscriptions ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`CREATE INDEX IF NOT EXISTS contributor_premium_active_idx ON contributor_premium_subscriptions(user_id, ends_at DESC) WHERE status = 'active'`;
}

export async function hasActivePremium(userId: number) {
  await ensurePremiumSubscriptionTable();
  const rows = await sql`
    SELECT EXISTS (
      SELECT 1 FROM contributor_premium_subscriptions
      WHERE user_id = ${userId} AND status = 'active'
        AND starts_at <= NOW() AND (is_permanent = TRUE OR ends_at > NOW())
    ) AS active
  `;
  return Boolean(rows[0]?.active);
}
