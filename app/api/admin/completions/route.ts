import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { checkMilestones, updateTrustScore, creditQLTAndUpdateLevel } from "@/lib/missionEngine";
import { log } from "@/lib/auditLog";
import { sendMissionApprovedEmail, sendMissionRejectedEmail } from "@/lib/email";
import { reviewCampaignSubmission } from "@/lib/universalCampaignEngine";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { createContributorNotification } from "@/lib/contributorNotifications";

async function ensureCompletionRewardReleaseSchema() {
  await sql`ALTER TABLE completions ADD COLUMN IF NOT EXISTS reward_released_at TIMESTAMPTZ`;
}

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page      = Math.max(1, Number(searchParams.get("page") ?? 1));
  const proofType = searchParams.get("proof_type") ?? "";
  const status    = searchParams.get("status") ?? "";
  const limit     = 30;
  const offset    = (page - 1) * limit;

  const [completions, countRows] = await Promise.all([
    sql`
      SELECT c.id, c.proof_value, c.completed_at, c.status, c.rejection_reason,
        c.xp_awarded, c.qlt_awarded,
        u.id AS user_id, u.full_name AS user_name, u.email, u.trust_score,
        t.title AS task_title, t.proof_type, t.category, COALESCE(c.qlt_awarded, t.reward) AS reward,
        t.reward AS task_reward,
        t.mission_type, t.xp_reward
      FROM completions c
      JOIN users u ON u.id = c.user_id
      JOIN tasks t ON t.id = c.task_id
      WHERE (${proofType} = '' OR t.proof_type = ${proofType})
        AND (${status} = '' OR c.status = ${status})
      ORDER BY c.completed_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `,
    sql`
      SELECT COUNT(*)::int AS total FROM completions c
      JOIN tasks t ON t.id = c.task_id
      WHERE (${proofType} = '' OR t.proof_type = ${proofType})
        AND (${status} = '' OR c.status = ${status})
    `,
  ]);

  return NextResponse.json({ completions, total: countRows[0].total });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureCompletionRewardReleaseSchema();

  const { completionId, action, rejectionReason } = await req.json();
  if (!completionId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const rows = await sql`
    SELECT c.*, t.reward, t.mission_type, t.xp_reward, t.title AS task_title, t.business_id,
           u.referred_by, u.balance AS current_balance
    FROM completions c
    JOIN tasks t ON t.id = c.task_id
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ${completionId}
  `;
  if (rows.length === 0) return NextResponse.json({ error: "Completion not found" }, { status: 404 });

  const completion = rows[0];

  // ── APPROVE ───────────────────────────────────────────────────────────────
  if (action === "approve") {
    const claimed = await sql`
      UPDATE completions
      SET status = 'approved',
          rejection_reason = NULL,
          reward_released_at = NOW()
      WHERE id = ${completionId}
        AND status = 'pending'
        AND reward_released_at IS NULL
      RETURNING id
    `;
    if (claimed.length === 0) {
      const latest = await sql`SELECT status, reward_released_at FROM completions WHERE id = ${completionId}`;
      if (latest[0]?.status === "approved" || latest[0]?.reward_released_at) {
        return NextResponse.json({ error: "Already approved and reward released" }, { status: 409 });
      }
      return NextResponse.json({ error: "Only pending submissions can be approved" }, { status: 409 });
    }

    await reviewCampaignSubmission({ completionId: Number(completionId), action: "approve" });

    const reward = Number(completion.qlt_awarded ?? completion.reward);
      // 1. Credit QLT balance + daily_earned
      await sql`
        UPDATE users
        SET balance = balance + ${reward},
            daily_earned = daily_earned + ${reward},
            approved_count = approved_count + 1
        WHERE id = ${completion.user_id}
      `;

      // 2. Transaction record
      await sql`
        INSERT INTO transactions (user_id, type, amount, label)
        VALUES (${completion.user_id}, 'credit', ${reward}, ${"Mission Approved: " + completion.task_title})
      `;

      // 3. Credit QLT + update level based on lifetime earned
      const { newLevel, leveledUp, levelName, badgeEmoji } = await creditQLTAndUpdateLevel(completion.user_id, reward);

      // 4. Referral bonus (10%)
      if (completion.referred_by) {
        const bonus = Math.floor(reward * 0.1);
        if (bonus > 0) {
          await sql`UPDATE users SET balance = balance + ${bonus}, bonus_earned_qlt = bonus_earned_qlt + ${bonus} WHERE id = ${completion.referred_by}`;
          await sql`
            INSERT INTO transactions (user_id, type, amount, label)
            VALUES (${completion.referred_by}, 'credit', ${bonus}, 'Referral Earnings (10%)')
          `;
          await log(completion.referred_by, "referral_bonus", {
            fromUserId: completion.user_id, completionId, bonus,
          }, "completion", completionId);
        }
      }

      // 5. Update trust score
      const { trustScore } = await updateTrustScore(completion.user_id);

      // 6. Check milestones
      const { awarded: milestones } = await checkMilestones(completion.user_id);

      await log(completion.user_id, "mission_approved", {
        completionId, reward, newLevel, leveledUp, levelName, trustScore,
      }, "completion", completionId);

      await log(completion.user_id, "wallet_credited", {
        amount: reward, label: "Mission Approved: " + completion.task_title,
      }, "completion", completionId);

      await createContributorNotification({
        userId: Number(completion.user_id),
        type: "submission_approved",
        title: "Submission approved",
        message: `Your submission for ${completion.task_title} was approved.`,
        href: "/wallet",
        dedupeKey: `submission:${completionId}:approved`,
        metadata: { completionId, taskId: completion.task_id, reward },
      });

      await createContributorNotification({
        userId: Number(completion.user_id),
        type: "reward_credited",
        title: "QLT credited",
        message: `${reward.toLocaleString()} QLT has been added to your contributor wallet.`,
        href: "/wallet",
        dedupeKey: `reward:${completionId}`,
        metadata: { completionId, taskId: completion.task_id, reward },
      });

      if (leveledUp) {
        await log(completion.user_id, "level_up", { newLevel, levelName, badgeEmoji }, "user", completion.user_id);
      }

      if (completion.business_id) {
        await createBusinessNotification({
          businessId: Number(completion.business_id),
          type: "participation",
          tone: "green",
          title: "Contributor proof approved",
          body: `A proof submission for ${completion.task_title} was approved and ${reward.toLocaleString()} QLT was released.`,
          status: "Approved",
          href: `/business/tasks/${completion.task_id}`,
          metadata: { completionId, taskId: completion.task_id, contributorId: completion.user_id, reward },
        });
      }

      // 8. Email notification (non-blocking)
      const userEmail = await sql`SELECT email, full_name FROM users WHERE id = ${completion.user_id}`;
      if (userEmail.length > 0) {
        sendMissionApprovedEmail(userEmail[0].email, userEmail[0].full_name, completion.task_title, reward).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        message: "Approved - QLT credited",
        newLevel,
        leveledUp,
        trustScore,
        milestones,
      });

  }

  // ── REJECT ────────────────────────────────────────────────────────────────
  if (action === "reject") {
    const reason = rejectionReason?.trim() || "Mission not completed correctly";
    const claimed = await sql`
      UPDATE completions
      SET status = 'rejected', rejection_reason = ${reason}
      WHERE id = ${completionId}
        AND status = 'pending'
        AND reward_released_at IS NULL
      RETURNING id
    `;
    if (claimed.length === 0) {
      return NextResponse.json({ error: "Only pending submissions can be rejected" }, { status: 409 });
    }

    await reviewCampaignSubmission({ completionId: Number(completionId), action: "reject", reviewNote: reason });
    await sql`UPDATE users SET rejected_count = rejected_count + 1 WHERE id = ${completion.user_id}`;
    await sql`
      UPDATE tasks
      SET budget_used = GREATEST(0, budget_used - ${Number(completion.qlt_awarded ?? completion.reward)}),
          is_active = CASE
            WHEN COALESCE(task_status, 'active') = 'active' THEN true
            ELSE is_active
          END
      WHERE id = ${completion.task_id}
        AND total_budget > 0
    `;

    const { trustScore } = await updateTrustScore(completion.user_id);

    // Flag account if trust score drops too low
    if (trustScore < 30) {
      await sql`UPDATE users SET trust_level = 'flagged' WHERE id = ${completion.user_id}`;
      await log(completion.user_id, "fraud_flagged", { reason: "trust_score_below_30", trustScore }, "user", completion.user_id);
    }

    await log(completion.user_id, "mission_rejected", {
      completionId, reason, trustScore,
    }, "completion", completionId);

    await createContributorNotification({
      userId: Number(completion.user_id),
      type: "submission_rejected",
      title: "Submission rejected",
      message: `Your submission for ${completion.task_title} was rejected. Reason: ${reason}`,
      href: "/tasks",
      dedupeKey: `submission:${completionId}:attempt:${Number(completion.attempt_count ?? 1)}:rejected`,
      metadata: { completionId, taskId: completion.task_id, reason },
    });

    if (completion.business_id) {
      await createBusinessNotification({
        businessId: Number(completion.business_id),
        type: "participation",
        tone: "gold",
        title: "Contributor proof rejected",
        body: `A proof submission for ${completion.task_title} was rejected. Reason: ${reason}.`,
        status: "Rejected",
        href: `/business/tasks/${completion.task_id}`,
        metadata: { completionId, taskId: completion.task_id, contributorId: completion.user_id, reason },
      });
    }

    // Email notification (non-blocking)
    const userEmail = await sql`SELECT email, full_name FROM users WHERE id = ${completion.user_id}`;
    if (userEmail.length > 0) {
      sendMissionRejectedEmail(userEmail[0].email, userEmail[0].full_name, completion.task_title, reason).catch(() => {});
    }

    return NextResponse.json({ ok: true, message: "Rejected", trustScore });
  }
}
