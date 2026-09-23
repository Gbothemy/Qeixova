import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { ensureUniversalCampaignTables } from "@/lib/universalCampaignEngine";

export async function GET(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUniversalCampaignTables();
  const taskId = Number(req.nextUrl.searchParams.get("taskId")) || 0;
  const rows = await sql`
    SELECT t.id, t.title, t.category, t.task_status AS status, t.created_at, t.approved_at, t.expires_at,
      t.total_budget, t.budget_used, t.target_completion_count,
      COUNT(comp.id)::int AS submissions,
      COUNT(comp.id) FILTER (WHERE comp.status='approved')::int AS approved,
      COUNT(comp.id) FILTER (WHERE comp.status='pending')::int AS pending,
      COUNT(comp.id) FILTER (WHERE comp.status='rejected')::int AS rejected,
      COALESCE(SUM(comp.qlt_awarded) FILTER (WHERE comp.status='approved'),0)::int AS rewards_released,
      COALESCE(cw.reserved_rewards,0)::int AS reserved_rewards,
      COALESCE(cw.refunded_amount,0)::int AS refunded_amount,
      COALESCE(cw.platform_earned,0)::int AS platform_earned
    FROM tasks t
    LEFT JOIN completions comp ON comp.task_id=t.id
    LEFT JOIN campaigns c ON c.task_id=t.id
    LEFT JOIN campaign_wallets cw ON cw.campaign_id=c.id
    WHERE t.business_id=${session.businessId} AND COALESCE(t.task_status,'') <> 'deleted'
      AND (${taskId}=0 OR t.id=${taskId})
    GROUP BY t.id,cw.reserved_rewards,cw.refunded_amount,cw.platform_earned
    ORDER BY t.created_at DESC`;
  const totals = rows.reduce((a, r) => ({
    campaigns:a.campaigns+1, submissions:a.submissions+Number(r.submissions), approved:a.approved+Number(r.approved),
    rejected:a.rejected+Number(r.rejected), spent:a.spent+Number(r.budget_used), refunded:a.refunded+Number(r.refunded_amount)
  }), {campaigns:0,submissions:0,approved:0,rejected:0,spent:0,refunded:0});
  return NextResponse.json({ campaigns: rows, totals });
}
