import { ensureBusinessWalletTables } from "@/lib/businessWallet";
import { sql } from "@/lib/db";

export async function refundUnusedCampaignBudget(input: { campaignId: number; businessId?: number; reason?: string }) {
  await ensureBusinessWalletTables();
  const reference = `QXF-${input.campaignId}-UNUSED`;
  const reason = input.reason || "unused_campaign_budget";

  const rows = await sql`
    WITH candidate AS (
      SELECT
        c.id AS campaign_id,
        c.business_id,
        c.title,
        GREATEST(
          0,
          c.total_budget - c.spent_budget - c.platform_commission - c.verification_fee
            - COALESCE(cw.refunded_amount, 0)
        )::int AS refundable
      FROM campaigns c
      LEFT JOIN campaign_wallets cw ON cw.campaign_id = c.id
      WHERE c.id = ${input.campaignId}
        AND (${input.businessId ?? null}::int IS NULL OR c.business_id = ${input.businessId ?? null})
    ),
    campaign_refund AS (
      INSERT INTO campaign_transactions (
        campaign_id, user_id, transaction_type, amount, status, reference, metadata
      )
      SELECT
        campaign_id, business_id, 'refund_unused', refundable, 'completed', ${reference},
        ${JSON.stringify({ reason })}::jsonb
      FROM candidate
      WHERE refundable > 0
      ON CONFLICT (reference) DO NOTHING
      RETURNING campaign_id, user_id AS business_id, amount
    ),
    business_refund AS (
      INSERT INTO business_transactions (
        business_id, type, amount, label, status, provider, reference, metadata
      )
      SELECT
        campaign_refund.business_id,
        'credit',
        campaign_refund.amount,
        'Unused campaign reserve returned: ' || candidate.title,
        'completed',
        'campaign_refund',
        ${reference},
        ${JSON.stringify({ campaignId: input.campaignId, reason })}::jsonb
      FROM campaign_refund
      JOIN candidate ON candidate.campaign_id = campaign_refund.campaign_id
      ON CONFLICT (reference) DO NOTHING
      RETURNING business_id, amount
    ),
    wallet_update AS (
      UPDATE campaign_wallets cw
      SET refunded_amount = cw.refunded_amount + business_refund.amount,
          reserved_rewards = GREATEST(0, cw.reserved_rewards - business_refund.amount),
          available_balance = GREATEST(0, cw.available_balance - business_refund.amount),
          updated_at = NOW()
      FROM business_refund
      WHERE cw.campaign_id = ${input.campaignId}
      RETURNING business_refund.business_id, business_refund.amount
    ),
    balance_update AS (
      UPDATE businesses b
      SET balance = b.balance + wallet_update.amount
      FROM wallet_update
      WHERE b.id = wallet_update.business_id
      RETURNING wallet_update.amount
    )
    SELECT COALESCE((SELECT amount FROM balance_update LIMIT 1), 0)::int AS refunded
  `;

  return { ok: true, refunded: Number(rows[0]?.refunded ?? 0) };
}
