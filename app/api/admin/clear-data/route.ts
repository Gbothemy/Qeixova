import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { createSafetySnapshot, ensureAdminPlatformTables, getAdminContext, logAdminAction } from "@/lib/adminPlatform";

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

  const { scope, confirmation } = await req.json();
  const actor=await getAdminContext();
  if(!actor||actor.role!=="super_admin") return NextResponse.json({error:"Super-admin access is required"},{status:403});
  if(actor?.role!=="super_admin") return NextResponse.json({error:"Super Admin permission is required"},{status:403});
  await ensureAdminPlatformTables();
  const required=`CONFIRM ${String(scope).toUpperCase()}`;
  if(confirmation!==required) return NextResponse.json({error:`Type ${required} to continue`},{status:400});
  if(process.env.NODE_ENV==="production"&&scope==="all"&&process.env.ALLOW_PRODUCTION_DATA_WIPE!=="true") return NextResponse.json({error:"Full data wipe is disabled in production"},{status:403});
  if(process.env.NODE_ENV==="production"&&["users","tasks_hard","all"].includes(scope)){
    if(!actor.id)return NextResponse.json({error:"Critical operations require an individual Super Admin account"},{status:403});
    await sql`DELETE FROM admin_action_approvals WHERE expires_at<NOW() OR status<>'pending'`;
    const approvals=await sql`SELECT id,requested_by FROM admin_action_approvals WHERE action=${`clear_data:${scope}`} AND status='pending' AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1`;
    if(!approvals[0]){
      await sql`INSERT INTO admin_action_approvals(action,payload,requested_by) VALUES (${`clear_data:${scope}`},${JSON.stringify({scope})},${actor.id})`;
      await logAdminAction({action:"data_management.first_approval",entityType:"scope",entityId:scope,reason:"Awaiting second Super Admin"},actor);
      return NextResponse.json({ok:true,approvalRequired:true,message:"First approval recorded. A different Super Admin must repeat this confirmed action within 30 minutes."},{status:202});
    }
    if(Number(approvals[0].requested_by)===actor.id)return NextResponse.json({error:"A different Super Admin must provide the second approval"},{status:409});
    await sql`UPDATE admin_action_approvals SET status='approved',approved_by=${actor.id} WHERE id=${approvals[0].id}`;
  }
  await logAdminAction({action:"data_management.execute",entityType:"scope",entityId:scope,reason:"Typed destructive-action confirmation"},actor);
  const backupId=await createSafetySnapshot(`Before ${scope} data-management action`,actor.id);
  await logAdminAction({action:"backup.safety_snapshot",entityType:"backup",entityId:backupId,after:{scope}},actor);

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
      return NextResponse.json({ ok: true, message: "All app data cleared. Growth Partner and business emails can be registered again." });

    default:
      return NextResponse.json({ error: "Unknown scope" }, { status: 400 });
  }
}
