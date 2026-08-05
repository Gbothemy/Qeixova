import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";

async function wipeAllAppData() {
  await sql`
    DO $$
    DECLARE
      tables_to_clear text[] := ARRAY[
        'campaign_proofs',
        'campaign_submissions',
        'campaign_claims',
        'campaign_disputes',
        'campaign_transactions',
        'campaign_wallets',
        'campaign_notifications',
        'campaign_timers',
        'campaign_verification_rules',
        'campaign_targeting',
        'campaign_platforms',
        'campaign_actions',
        'campaigns',
        'business_transactions',
        'business_notifications',
        'community_post_reactions',
        'community_post_comments',
        'community_posts',
        'bank_accounts',
        'notification_prefs',
        'notifications',
        'password_resets',
        'completions',
        'transactions',
        'withdrawals',
        'tasks',
        'users',
        'businesses'
      ];
      existing_tables text;
    BEGIN
      SELECT string_agg(format('%I', tablename), ', ')
      INTO existing_tables
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(tables_to_clear);

      IF existing_tables IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || existing_tables || ' RESTART IDENTITY CASCADE';
      END IF;
    END $$;
  `;
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scope } = await req.json();

  switch (scope) {
    case "completions":
      // Clear all task completions and reset user balances earned from tasks
      await sql`DELETE FROM completions`;
      // Reset budget_used on all tasks
      await sql`UPDATE tasks SET budget_used = 0, is_active = TRUE WHERE total_budget > 0`;
      return NextResponse.json({ ok: true, message: "All task completions cleared. Task budgets reset." });

    case "transactions":
      await sql`DELETE FROM transactions`;
      // Reset all user balances to 0
      await sql`UPDATE users SET balance = 0`;
      return NextResponse.json({ ok: true, message: "All transactions cleared. User balances reset to 0." });

    case "users":
      // Delete all non-admin users (keeps tasks intact)
      await sql`DELETE FROM bank_accounts`;
      await sql`DELETE FROM notification_prefs`;
      await sql`DELETE FROM password_resets`;
      await sql`DELETE FROM completions`;
      await sql`DELETE FROM transactions`;
      await sql`DELETE FROM users`;
      return NextResponse.json({ ok: true, message: "All users and their data cleared." });

    case "tasks":
      // Deactivate all tasks (soft clear — keeps history)
      await sql`UPDATE tasks SET is_active = FALSE`;
      return NextResponse.json({ ok: true, message: "All tasks deactivated." });

    case "tasks_hard":
      // Hard delete all tasks and completions
      await sql`DELETE FROM completions`;
      await sql`DELETE FROM tasks`;
      return NextResponse.json({ ok: true, message: "All tasks permanently deleted." });

    case "all":
      // Nuclear option — wipe everything except the DB schema
      await wipeAllAppData();
      return NextResponse.json({ ok: true, message: "All app data cleared. Contributor and business emails can be registered again." });

    default:
      return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  }
}
