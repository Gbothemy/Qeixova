import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { ensureAdminPlatformTables, getAdminContext, logAdminAction } from "@/lib/adminPlatform";

const DEFAULT_CONFIGS = [
  ["max_submissions_per_hour", "10", "Maximum proof submissions a growth partner can make per hour."],
  ["referral_bonus_qlt", "2500", "Reward paid to an existing growth partner when they refer a new user."],
  ["referral_welcome_qlt", "1000", "Welcome reward credited to referred growth partners."],
  ["referral_earnings_pct", "10", "Percentage of referred task earnings paid as referral commission."],
  ["min_withdrawal_qlt", "100000", "Minimum growth partner wallet balance required before withdrawal."],
  ["platform_fee_pct", "20", "Platform commission percentage used for campaign pricing."],
  ["trust_score_flag_threshold", "30", "Trust score below this value marks an account for admin review."],
  ["trust_score_min_missions", "3", "Minimum reviewed missions before trust enforcement becomes meaningful."],
  ["dual_approval_withdrawal_qlt", "1000000", "Withdrawal amount requiring approval from two different administrators."],
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
  if (!await checkAdminAuth(req,"economy.read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemConfig();
  await ensureAdminPlatformTables();
  const [configs,history] = await Promise.all([sql`SELECT key, value, description, updated_at FROM system_config ORDER BY key`,sql`SELECT * FROM admin_config_history ORDER BY created_at DESC LIMIT 30`]);
  return NextResponse.json({ configs, history });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req,"economy.manage")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureSystemConfig();
  const { key, value, reason } = await req.json();
  if (!key || value === undefined) return NextResponse.json({ error: "key and value required" }, { status: 400 });

  const ranges:Record<string,[number,number]>={max_submissions_per_hour:[1,100],referral_bonus_qlt:[0,1000000],referral_welcome_qlt:[0,1000000],referral_earnings_pct:[0,100],min_withdrawal_qlt:[1,100000000],platform_fee_pct:[0,100],trust_score_flag_threshold:[0,100],trust_score_min_missions:[0,1000],dual_approval_withdrawal_qlt:[1,1000000000]};
  const numeric=Number(value),range=ranges[String(key)];
  if(!range||!Number.isFinite(numeric)||numeric<range[0]||numeric>range[1]) return NextResponse.json({error:`Value must be between ${range?.[0]??0} and ${range?.[1]??0}`},{status:400});
  if(!String(reason??"").trim()) return NextResponse.json({error:"A change reason is required"},{status:400});
  const existing=await sql`SELECT value FROM system_config WHERE key=${String(key)}`;
  const actor=await getAdminContext();

  await sql`
    UPDATE system_config SET value = ${String(value)}, updated_at = NOW()
    WHERE key = ${key}
  `;
  await ensureAdminPlatformTables();
  await sql`INSERT INTO admin_config_history(config_key,old_value,new_value,reason,admin_id,admin_email) VALUES (${String(key)},${existing[0]?.value??null},${String(value)},${String(reason)},${actor?.id??null},${actor?.email??"platform-admin"})`;
  await logAdminAction({action:"economy.config_changed",entityType:"config",entityId:String(key),before:{value:existing[0]?.value},after:{value:String(value)},reason:String(reason)},actor);
  return NextResponse.json({ ok: true });
}
