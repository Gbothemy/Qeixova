import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { canAdmin, getAdminContext, logAdminAction } from "@/lib/adminPlatform";
import { sql } from "@/lib/db";
import { ensureUniversalCampaignTables, refundUnusedCampaignBudget, transitionCampaignStatus } from "@/lib/universalCampaignEngine";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { activateMissionExpiryByTask, expireElapsedMissions } from "@/lib/missionExpiry";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req,"campaigns.read")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const actor=await getAdminContext();
    await ensureUniversalCampaignTables();
    await expireElapsedMissions();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "";
  const campaigns = await sql`
    SELECT
      c.id,
      t.id AS task_id,
      t.business_id,
      COALESCE(c.mission_category, t.category) AS mission_category,
      COALESCE(c.campaign_goal, t.campaign_goal, t.category) AS campaign_goal,
      COALESCE(c.title, t.title) AS title,
      COALESCE(NULLIF(c.description, ''), t.instructions, '') AS description,
      COALESCE(c.status, t.campaign_status, t.task_status, 'pending_review') AS status,
      COALESCE(c.start_date, t.approved_at, NULL) AS start_date,
      COALESCE(c.end_date, t.expires_at, NULL) AS end_date,
      t.duration,
      COALESCE(c.total_slots, t.target_completion_count, 0) AS total_slots,
      COALESCE(c.filled_slots, 0) AS filled_slots,
      COALESCE(c.completed_slots, 0) AS completed_slots,
      COALESCE(c.approved_slots, 0) AS approved_slots,
      COALESCE(c.rejected_slots, 0) AS rejected_slots,
      COALESCE(c.total_budget, t.total_budget, 0) AS total_budget,
      COALESCE(c.available_budget, 0) AS available_budget,
      COALESCE(c.reserved_budget, 0) AS reserved_budget,
      COALESCE(c.spent_budget, t.budget_used, 0) AS spent_budget,
      COALESCE(c.platform_commission, 0) AS platform_commission,
      COALESCE(c.verification_fee, 0) AS verification_fee,
      COALESCE(c.targeting_fee, 0) AS targeting_fee,
      COALESCE(c.quality_premium, 0) AS quality_premium,
      COALESCE(c.pricing, t.campaign_pricing, '{}'::jsonb) AS pricing,
      COALESCE(c.metadata, t.campaign_metadata, '{}'::jsonb) AS metadata,
      COALESCE(c.created_at, t.created_at) AS created_at,
      COALESCE(c.updated_at, t.created_at) AS updated_at,
      b.name AS business_name,
      b.email AS business_email,
      t.category AS task_category,
      t.reward AS task_reward,
      t.total_budget AS task_total_budget,
      t.budget_used AS task_budget_used,
      t.task_status,
      t.campaign_status AS task_campaign_status,
      t.is_active AS task_is_active,
      t.task_link,
      COALESCE(t.target_interests, '{}') AS target_interests,
      COALESCE(t.target_platforms, '{}') AS target_platforms,
      COALESCE(t.target_states, '{}') AS target_states,
      COALESCE(t.campaign_metadata, '{}'::jsonb) AS task_metadata,
      COUNT(cs.id)::int AS submissions_count,
      COUNT(CASE WHEN cs.status = 'under_review' THEN 1 END)::int AS pending_review_count,
      COUNT(CASE WHEN cs.status = 'approved' THEN 1 END)::int AS approved_count,
      COUNT(CASE WHEN cs.status = 'rejected' THEN 1 END)::int AS rejected_count,
      COUNT(CASE WHEN cs.status = 'disputed' THEN 1 END)::int AS disputed_count
    FROM tasks t
    LEFT JOIN campaigns c ON c.task_id = t.id
    LEFT JOIN businesses b ON b.id = t.business_id
    LEFT JOIN campaign_submissions cs ON cs.campaign_id = c.id
    WHERE t.business_id IS NOT NULL
      AND (${status} = '' OR COALESCE(c.status, t.campaign_status, t.task_status, '') = ${status})
    GROUP BY c.id, b.id, t.id
    ORDER BY COALESCE(c.created_at, t.created_at) DESC
    LIMIT 100
  `;

    return NextResponse.json({ campaigns, canManage:Boolean(actor&&canAdmin(actor,"campaigns.manage")) });
  } catch (error) {
    console.error("[api/admin/campaigns] failed to load campaigns", error);
    return NextResponse.json({ error: "Campaign data is temporarily unavailable. Please retry." }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req,"campaigns.manage")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const campaignId = Number(body.campaignId);
  const taskId = Number(body.taskId);
  const action = String(body.action || "");
  const actor=await getAdminContext();
  if ((!Number.isFinite(campaignId) || campaignId <= 0) && (!Number.isFinite(taskId) || taskId <= 0)) {
    return NextResponse.json({ error: "campaignId or taskId required" }, { status: 400 });
  }

  if ((!Number.isFinite(campaignId) || campaignId <= 0) && taskId > 0) {
    await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ`;
    const rows = await sql`SELECT business_id, title, approved_at, expires_at, scheduled_start_at FROM tasks WHERE id = ${taskId}`;
    if (rows.length === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    if (action === "approve" || action === "launch" || action === "resume") {
      const scheduled = rows[0].scheduled_start_at && new Date(rows[0].scheduled_start_at).getTime() > Date.now();
      await sql`UPDATE tasks SET is_active = ${!scheduled}, task_status = ${scheduled ? "scheduled" : "active"}, campaign_status = ${scheduled ? "scheduled" : "live"} WHERE id = ${taskId}`;
      if (!scheduled && (action !== "resume" || !rows[0].expires_at)) await activateMissionExpiryByTask(taskId);
      if (rows[0]?.business_id) {
        await createBusinessNotification({
          businessId: Number(rows[0].business_id),
          type: "approved",
          tone: "green",
          title: "Campaign approved",
          body: scheduled ? `${rows[0].title} has been approved and will launch at the scheduled time.` : `${rows[0].title} has been approved by admin and is now visible to growth partners.`,
          status: scheduled ? "Scheduled" : "Live",
          href: `/business/tasks/${taskId}`,
          metadata: { taskId, action },
        });
      }
      await logAdminAction({action:`campaign.${action}`,entityType:"task",entityId:taskId,before:rows[0],after:{status:scheduled?"scheduled":"live"},reason:body.reason},actor);
      return NextResponse.json({ ok: true, status: scheduled ? "scheduled" : "live" });
    }
    if (action === "reject") {
      const reason = String(body.reason || "Campaign needs edits");
      await sql`
        UPDATE tasks
        SET is_active = FALSE,
            task_status = 'rejected',
            campaign_status = 'rejected',
            campaign_metadata = jsonb_set(COALESCE(campaign_metadata, '{}'::jsonb), '{rejectionReason}', to_jsonb(${reason}::text), true)
        WHERE id = ${taskId}
      `;
      if (rows[0]?.business_id) {
        await createBusinessNotification({
          businessId: Number(rows[0].business_id),
          type: "verification",
          tone: "gold",
          title: "Campaign needs changes",
          body: `${rows[0].title} was not approved. Reason: ${reason}.`,
          status: "Rejected",
          href: `/business/tasks/${taskId}`,
          metadata: { taskId, reason },
        });
      }
      await logAdminAction({action:"campaign.reject",entityType:"task",entityId:taskId,before:rows[0],after:{status:"rejected"},reason},actor);
      return NextResponse.json({ ok: true, status: "rejected" });
    }
    return NextResponse.json({ error: "This campaign record is missing. Only approve/reject is available." }, { status: 400 });
  }

  if (action === "approve" || action === "launch") {
    const result = await transitionCampaignStatus({ campaignId, nextStatus: "live", reason: body.reason });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: Number(result.status) });
    const rows = await sql`SELECT business_id, task_id, title FROM campaigns WHERE id = ${campaignId}`;
    if (rows[0]?.business_id) {
      await createBusinessNotification({
        businessId: Number(rows[0].business_id),
        type: "approved",
        tone: "green",
        title: "Campaign approved",
        body: `${rows[0].title} has been approved by admin and is now visible to growth partners.`,
        status: "Live",
        href: `/business/tasks/${rows[0].task_id}`,
        metadata: { campaignId, taskId: rows[0].task_id, action },
      });
    }
    await logAdminAction({action:`campaign.${action}`,entityType:"campaign",entityId:campaignId,after:result,reason:body.reason},actor);
    return NextResponse.json(result);
  }
  if (action === "pause") {
    const result = await transitionCampaignStatus({ campaignId, nextStatus: "paused", reason: body.reason });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: Number(result.status) });
    const rows = await sql`SELECT business_id, task_id, title FROM campaigns WHERE id = ${campaignId}`;
    if (rows[0]?.business_id) {
      await createBusinessNotification({
        businessId: Number(rows[0].business_id),
        type: "campaign",
        tone: "gold",
        title: "Campaign paused",
        body: `${rows[0].title} has been paused by admin.`,
        status: "Paused",
        href: `/business/tasks/${rows[0].task_id}`,
        metadata: { campaignId, taskId: rows[0].task_id },
      });
    }
    await logAdminAction({action:"campaign.pause",entityType:"campaign",entityId:campaignId,after:result,reason:body.reason},actor);
    return NextResponse.json(result);
  }
  if (action === "resume") {
    const result = await transitionCampaignStatus({ campaignId, nextStatus: "live", reason: body.reason });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: Number(result.status) });
    const rows = await sql`SELECT business_id, task_id, title FROM campaigns WHERE id = ${campaignId}`;
    if (rows[0]?.business_id) {
      await createBusinessNotification({
        businessId: Number(rows[0].business_id),
        type: "approved",
        tone: "green",
        title: "Campaign resumed",
        body: `${rows[0].title} is live again and visible to growth partners.`,
        status: "Live",
        href: `/business/tasks/${rows[0].task_id}`,
        metadata: { campaignId, taskId: rows[0].task_id },
      });
    }
    await logAdminAction({action:"campaign.resume",entityType:"campaign",entityId:campaignId,after:result,reason:body.reason},actor);
    return NextResponse.json(result);
  }
  if (action === "reject") {
    const rows = await sql`SELECT business_id, task_id, title FROM campaigns WHERE id = ${campaignId}`;
    await sql`
      UPDATE campaigns
      SET status = 'rejected',
          metadata = jsonb_set(metadata, '{rejectionReason}', to_jsonb(${String(body.reason || "Campaign needs edits")}::text), true),
          updated_at = NOW()
      WHERE id = ${campaignId}
    `;
    await sql`
      UPDATE tasks
      SET is_active = FALSE,
          task_status = 'rejected',
          campaign_status = 'rejected',
          campaign_metadata = jsonb_set(COALESCE(campaign_metadata, '{}'::jsonb), '{rejectionReason}', to_jsonb(${String(body.reason || "Campaign needs edits")}::text), true)
      WHERE id = (SELECT task_id FROM campaigns WHERE id = ${campaignId})
    `;
    if (rows[0]?.business_id) {
      await createBusinessNotification({
        businessId: Number(rows[0].business_id),
        type: "verification",
        tone: "gold",
        title: "Campaign needs changes",
        body: `${rows[0].title} was not approved. Reason: ${String(body.reason || "Campaign needs edits")}.`,
        status: "Rejected",
        href: `/business/tasks/${rows[0].task_id}`,
        metadata: { campaignId, taskId: rows[0].task_id, reason: String(body.reason || "Campaign needs edits") },
      });
    }
    await logAdminAction({action:"campaign.reject",entityType:"campaign",entityId:campaignId,before:rows[0],after:{status:"rejected"},reason:String(body.reason||"Campaign needs edits")},actor);
    return NextResponse.json({ ok: true, status: "rejected" });
  }
  if (action === "close") {
    const rows = await sql`SELECT business_id, task_id, title FROM campaigns WHERE id = ${campaignId}`;
    await refundUnusedCampaignBudget({ campaignId, reason: "admin_close_campaign" });
    await sql`UPDATE campaigns SET status = 'closed', updated_at = NOW() WHERE id = ${campaignId}`;
    await sql`
      UPDATE tasks
      SET is_active = FALSE, task_status = 'closed', campaign_status = 'closed'
      WHERE id = (SELECT task_id FROM campaigns WHERE id = ${campaignId})
    `;
    if (rows[0]?.business_id) {
      await createBusinessNotification({
        businessId: Number(rows[0].business_id),
        type: "campaign",
        tone: "blue",
        title: "Campaign closed",
        body: `${rows[0].title} has been closed. Any unused budget refund will appear in wallet activity.`,
        status: "Closed",
        href: `/business/tasks/${rows[0].task_id}`,
        metadata: { campaignId, taskId: rows[0].task_id },
      });
    }
    await logAdminAction({action:"campaign.close",entityType:"campaign",entityId:campaignId,before:rows[0],after:{status:"closed"},reason:body.reason||"Admin closed campaign"},actor);
    return NextResponse.json({ ok: true, status: "closed" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
