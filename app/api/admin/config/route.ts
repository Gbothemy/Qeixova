import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";

const DEFAULT_CONFIGS = [
  ["max_submissions_per_hour", "10", "Maximum proof submissions a contributor can make per hour."],
  ["referral_bonus_qlt", "2500", "Reward paid to an existing contributor when they refer a new user."],
  ["referral_welcome_qlt", "1000", "Welcome reward credited to referred contributors."],
  ["referral_earnings_pct", "10", "Percentage of referred task earnings paid as referral commission."],
  ["min_withdrawal_qlt", "100000", "Minimum contributor wallet balance required before withdrawal."],
  ["platform_fee_pct", "20", "Platform commission percentage used for campaign pricing."],
  ["trust_score_flag_threshold", "30", "Trust score below this value marks an account for admin review."],
  ["trust_score_min_missions", "3", "Minimum reviewed missions before trust enforcement becomes meaningful."],
] as const;

async function ensureSystemConfig() {
  await sql`
    CREATE TABLE IF NOT EXISTS system_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  for (const [key, value, description] of DEFAULT_CONFIGS) {
    await sql`
      INSERT INTO system_config (key, value, description)
      VALUES (${key}, ${value}, ${description})
      ON CONFLICT (key) DO NOTHING
    `;
  }
}

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemConfig();
  const configs = await sql`SELECT key, value, description, updated_at FROM system_config ORDER BY key`;
  return NextResponse.json({ configs });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemConfig();
  const { key, value } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });

  await sql`
    UPDATE system_config SET value = ${String(value)}, updated_at = NOW()
    WHERE key = ${key}
  `;
  return NextResponse.json({ ok: true });
}
