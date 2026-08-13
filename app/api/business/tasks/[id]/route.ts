import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { checkMilestones, creditQLTAndUpdateLevel, updateTrustScore } from "@/lib/missionEngine";
import { log } from "@/lib/auditLog";
import { sendMissionApprovedEmail, sendMissionRejectedEmail } from "@/lib/email";
import { ensureBusinessWalletTables } from "@/lib/businessWallet";
import { refundUnusedCampaignBudget, reviewCampaignSubmission, transitionCampaignStatus } from "@/lib/universalCampaignEngine";

type ProofPlatform = { id: string; label: string; platform: string; rewardQlt: number };

function summarizeProofForBusiness(value: unknown) {
  if (typeof value !== "string" || !value) {
    return { hasProof: false, hasScreenshots: false, selectedPlatforms: [] as ProofPlatform[] };
  }

  if (value.startsWith("data:image/")) {
    return { hasProof: true, hasScreenshots: true, selectedPlatforms: [] as ProofPlatform[] };
  }

  try {
    const parsed = JSON.parse(value) as {
      type?: string;
      screenshots?: unknown[];
      selectedPlatforms?: Partial<ProofPlatform>[];
    };
    const selectedPlatforms = Array.isArray(parsed.selectedPlatforms)
      ? parsed.selectedPlatforms
        .filter((platform) => typeof platform?.platform === "string")
        .map((platform) => ({
          id: String(platform.id || platform.platform),
          label: String(platform.label || platform.platform),
          platform: String(platform.platform),
          rewardQlt: Number(platform.rewardQlt) || 0,
        }))
      : [];

    return {
      hasProof: true,
      hasScreenshots: parsed.type === "screenshots" || (Array.isArray(parsed.screenshots) && parsed.screenshots.length > 0),
      selectedPlatforms,
    };
  } catch {
    return { hasProof: true, hasScreenshots: false, selectedPlatforms: [] as ProofPlatform[] };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const taskRows = await sql`
    SELECT t.*,
      t.task_status AS status,
      COUNT(c.id)::int AS total_completions,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END)::int AS pending_completions,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END)::int AS approved_completions,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END)::int AS rejected_completions
    FROM tasks t
    LEFT JOIN completions c ON c.task_id = t.id
    WHERE t.id = ${Number(id)} AND t.business_id = ${session.businessId}
    GROUP BY t.id
  `;

  if (taskRows.length === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const completions = await sql`
    SELECT c.id, c.status, c.completed_at, c.rejection_reason, c.proof_value, c.qlt_awarded,
      u.full_name, u.email
    FROM completions c
    JOIN users u ON u.id = c.user_id
    WHERE c.task_id = ${Number(id)}
    ORDER BY c.completed_at DESC
    LIMIT 50
  `;

  const safeCompletions = completions.map((completion) => {
    const { proof_value: proofValue, ...safeCompletion } = completion;
    return {
      ...safeCompletion,
      proof_summary: summarizeProofForBusiness(proofValue),
    };
  });

  return NextResponse.json({ task: taskRows[0], completions: safeCompletions });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action, completionId, rejectionReason } = await req.json();

  // Verify ownership
  const rows = await sql`SELECT id, title, task_status, total_budget, budget_used FROM tasks WHERE id = ${Number(id)} AND business_id = ${session.businessId}`;
  if (rows.length === 0) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (action === "approve" || action === "reject") {
    if (!completionId) return NextResponse.json({ error: "completionId required" }, { status: 400 });

    const completionRows = await sql`
      SELECT c.*, t.reward, t.mission_type, t.xp_reward, t.title AS task_title,
             u.email, u.full_name, u.referred_by
      FROM completions c
      JOIN tasks t ON t.id = c.task_id
      JOIN users u ON u.id = c.user_id
      WHERE c.id = ${Number(completionId)}
        AND c.task_id = ${Number(id)}
        AND t.business_id = ${session.businessId}
    `;
    if (completionRows.length === 0) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

    const completion = completionRows[0];
    if (completion.status !== "pending") {
      return NextResponse.json({ error: "Only pending submissions can be reviewed" }, { status: 409 });
    }

    if (action === "approve") {
      await sql`UPDATE completions SET status = 'approved', rejection_reason = NULL WHERE id = ${Number(completionId)}`;
      await reviewCampaignSubmission({ completionId: Number(completionId), action: "approve" });

      const reward = Number(completion.qlt_awarded ?? completion.reward);
      await sql`
        UPDATE users
        SET balance = balance + ${reward},
            daily_earned = daily_earned + ${reward},
            approved_count = approved_count + 1
        WHERE id = ${completion.user_id}
      `;
      await sql`
        INSERT INTO transactions (user_id, type, amount, label)
        VALUES (${completion.user_id}, 'credit', ${reward}, ${"Mission Approved: " + completion.task_title})
      `;

      const { newLevel, leveledUp, levelName } = await creditQLTAndUpdateLevel(completion.user_id, reward);

      if (completion.referred_by) {
        const bonus = Math.floor(reward * 0.1);
        if (bonus > 0) {
          await sql`UPDATE users SET balance = balance + ${bonus}, bonus_earned_qlt = bonus_earned_qlt + ${bonus} WHERE id = ${completion.referred_by}`;
          await sql`
            INSERT INTO transactions (user_id, type, amount, label)
            VALUES (${completion.referred_by}, 'credit', ${bonus}, 'Referral Earnings (10%)')
          `;
        }
      }

      const { trustScore } = await updateTrustScore(completion.user_id);
      const { awarded: milestones } = await checkMilestones(completion.user_id);
      await log(completion.user_id, "mission_approved", { completionId, reward, newLevel, leveledUp, levelName, trustScore }, "completion", Number(completionId));
      sendMissionApprovedEmail(completion.email, completion.full_name, completion.task_title, reward).catch(() => {});

      return NextResponse.json({ ok: true, message: "Approved", trustScore, milestones });
    }

    const reason = rejectionReason?.trim() || "Mission proof did not meet the campaign requirements";
    await sql`UPDATE completions SET status = 'rejected', rejection_reason = ${reason} WHERE id = ${Number(completionId)}`;
    await reviewCampaignSubmission({ completionId: Number(completionId), action: "reject", reviewNote: reason });
    await sql`UPDATE users SET rejected_count = rejected_count + 1 WHERE id = ${completion.user_id}`;
    await sql`
      UPDATE tasks
      SET budget_used = GREATEST(0, budget_used - ${Number(completion.qlt_awarded ?? completion.reward)}),
          is_active = CASE WHEN COALESCE(task_status, 'active') = 'active' THEN true ELSE is_active END
      WHERE id = ${Number(id)} AND total_budget > 0
    `;

    const { trustScore } = await updateTrustScore(completion.user_id);
    if (trustScore < 30) {
      await sql`UPDATE users SET trust_level = 'flagged' WHERE id = ${completion.user_id}`;
      await log(completion.user_id, "fraud_flagged", { reason: "trust_score_below_30", trustScore }, "user", completion.user_id);
    }
    await log(completion.user_id, "mission_rejected", { completionId, reason, trustScore }, "completion", Number(completionId));
    sendMissionRejectedEmail(completion.email, completion.full_name, completion.task_title, reason).catch(() => {});

    return NextResponse.json({ ok: true, message: "Rejected", trustScore });
  }

  if (action === "pause") {
    await sql`UPDATE tasks SET is_active = false, task_status = 'paused' WHERE id = ${Number(id)}`;
    const campaignRows = await sql`SELECT id FROM campaigns WHERE task_id = ${Number(id)} LIMIT 1`;
    if (campaignRows.length) await transitionCampaignStatus({ campaignId: Number(campaignRows[0].id), nextStatus: "paused" });
  } else if (action === "resume") {
    if (rows[0].task_status === "pending_review" || rows[0].task_status === "deleted") {
      return NextResponse.json({ error: "This campaign cannot be resumed yet" }, { status: 409 });
    }
    await sql`UPDATE tasks SET is_active = true, task_status = 'active' WHERE id = ${Number(id)}`;
    const campaignRows = await sql`SELECT id FROM campaigns WHERE task_id = ${Number(id)} LIMIT 1`;
    if (campaignRows.length) await transitionCampaignStatus({ campaignId: Number(campaignRows[0].id), nextStatus: "live" });
  } else if (action === "delete") {
    await ensureBusinessWalletTables();
    const refund = Math.max(0, Number(rows[0].total_budget ?? 0) - Number(rows[0].budget_used ?? 0));
    if (refund > 0) {
      await sql`UPDATE businesses SET balance = balance + ${refund} WHERE id = ${session.businessId}`;
      await sql`
        INSERT INTO business_transactions (business_id, type, amount, label, status, provider, reference, metadata)
        VALUES (
          ${session.businessId}, 'credit', ${refund}, ${"Unused campaign budget refunded: " + rows[0].title},
          'completed', 'campaign_refund', ${"QXR-" + Number(id)},
          ${JSON.stringify({ taskId: Number(id), reason: "campaign_deleted" })}
        )
        ON CONFLICT (reference) DO NOTHING
      `;
    }
    const campaignRows = await sql`SELECT id FROM campaigns WHERE task_id = ${Number(id)} LIMIT 1`;
    if (campaignRows.length) {
      await refundUnusedCampaignBudget({ campaignId: Number(campaignRows[0].id), businessId: session.businessId, reason: "campaign_deleted" });
      await sql`UPDATE campaigns SET status = 'closed', updated_at = NOW() WHERE id = ${Number(campaignRows[0].id)}`;
    }
    await sql`UPDATE tasks SET is_active = false, task_status = 'deleted' WHERE id = ${Number(id)}`;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
