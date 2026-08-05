import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { verifyProof } from "@/lib/verifyProof";
import { checkDailyCap, updateStreak, QLT_PROGRESS_REWARDS } from "@/lib/missionEngine";
import { checkRateLimit, incrementRateLimit, checkDuplicate, checkTrustScore } from "@/lib/antiFraud";
import { log } from "@/lib/auditLog";
import { syncCampaignSubmissionFromCompletion } from "@/lib/universalCampaignEngine";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { createContributorNotification } from "@/lib/contributorNotifications";
import { displayLevel } from "@/lib/levels";
import { getBusinessPlatformRewardQlt } from "@/lib/campaignPlatformPricing";
import { expireElapsedMissions } from "@/lib/missionExpiry";

function getAllowedMissionTypes(features: unknown) {
  const unlocks = Array.isArray(features) ? features.filter((item): item is string => typeof item === "string") : [];
  const allowed = new Set<string>();

  if (unlocks.length === 0 || unlocks.includes("open_missions") || unlocks.includes("all_missions")) {
    allowed.add("engagement");
    allowed.add("participation");
    allowed.add("premium");
  }
  if (unlocks.includes("engagement_missions")) allowed.add("engagement");
  if (unlocks.includes("participation_missions")) allowed.add("participation");
  if (unlocks.includes("premium_missions")) allowed.add("premium");

  return allowed;
}

function sanitizeProofValue(proofValue: string) {
  const trimmed = proofValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("data:image/")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as { type?: string; screenshots?: { name?: string; dataUrl?: string }[] };
    if (parsed.type === "screenshots" && Array.isArray(parsed.screenshots)) {
      const screenshots = parsed.screenshots
        .filter((shot) => typeof shot.dataUrl === "string" && shot.dataUrl.startsWith("data:image/"))
        .slice(0, 5)
        .map((shot, index) => ({
          name: typeof shot.name === "string" && shot.name.trim() ? shot.name.slice(0, 120) : `proof-${index + 1}`,
          dataUrl: shot.dataUrl,
        }));

      if (screenshots.length > 0) {
        return JSON.stringify({ type: "screenshots", screenshots });
      }
    }
  } catch {
    // Keep plain URL/text proof as submitted.
  }

  return trimmed;
}

type ProofSubmission = {
  proofForVerification: string;
  storedProof: string | null;
  selectedPlatforms: { id: string; label: string; platform: string; rewardQlt: number }[];
};

function parseStoredProofJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { type: "text", value };
  }
}

function parseProofSubmission(proofValue: string): ProofSubmission {
  const trimmed = proofValue.trim();
  if (!trimmed) return { proofForVerification: "", storedProof: null, selectedPlatforms: [] };

  try {
    const parsed = JSON.parse(trimmed) as {
      type?: string;
      value?: string;
      screenshots?: { name?: string; dataUrl?: string }[];
      selectedPlatforms?: { id?: string; label?: string; platform?: string; rewardQlt?: number }[];
    };
    const selectedPlatforms = Array.isArray(parsed.selectedPlatforms)
      ? parsed.selectedPlatforms
        .filter((option) => typeof option.id === "string" && typeof option.platform === "string")
        .map((option) => ({
          id: String(option.id),
          label: String(option.label || option.platform),
          platform: String(option.platform),
          rewardQlt: Number(option.rewardQlt) || 0,
        }))
      : [];

    if (parsed.type === "screenshots" && Array.isArray(parsed.screenshots)) {
      const screenshots = parsed.screenshots
        .filter((shot) => typeof shot.dataUrl === "string" && shot.dataUrl.startsWith("data:image/"))
        .slice(0, 5)
        .map((shot, index) => ({
          name: typeof shot.name === "string" && shot.name.trim() ? shot.name.slice(0, 120) : `proof-${index + 1}`,
          dataUrl: shot.dataUrl,
        }));
      return {
        proofForVerification: JSON.stringify({ type: "screenshots", screenshots }),
        storedProof: JSON.stringify({ type: "screenshots", screenshots, selectedPlatforms }),
        selectedPlatforms,
      };
    }

    const value = typeof parsed.value === "string" ? parsed.value.trim() : "";
    return {
      proofForVerification: value,
      storedProof: JSON.stringify({ type: parsed.type || "text", value, selectedPlatforms }),
      selectedPlatforms,
    };
  } catch {
    return { proofForVerification: trimmed, storedProof: sanitizeProofValue(trimmed), selectedPlatforms: [] };
  }
}

function splitRewardAcrossPlatforms(totalReward: number, platformCount: number) {
  const total = Math.max(0, Math.round(Number(totalReward) || 0));
  const count = Math.max(1, platformCount);
  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function getCampaignPlatformOptions(task: Record<string, unknown>) {
  const metadata = (task.campaign_metadata ?? {}) as {
    selectedPricingOptions?: { id?: string; label?: string; platform?: string; rewardQlt?: number }[];
    selectedPricingPlatforms?: string[];
  };
  if (Array.isArray(metadata.selectedPricingOptions) && metadata.selectedPricingOptions.length > 0) {
    return metadata.selectedPricingOptions
      .filter((option) => option.id && option.platform)
      .map((option) => ({
        id: String(option.id),
        label: String(option.label || option.platform),
        platform: String(option.platform),
        rewardQlt: Math.max(0, Math.round(Number(option.rewardQlt) || 0)),
      }));
  }
  const platforms = Array.isArray(metadata.selectedPricingPlatforms)
    ? metadata.selectedPricingPlatforms.filter((platform): platform is string => typeof platform === "string" && platform.trim().length > 0)
    : [];
  const splitRewards = splitRewardAcrossPlatforms(Number(task.reward ?? 0), platforms.length);
  return platforms.map((platform, index) => ({
    id: `platform-${index}`,
    label: platform,
    platform,
    rewardQlt: getBusinessPlatformRewardQlt(platform) ?? splitRewards[index] ?? 0,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await expireElapsedMissions();

    const body = await req.json().catch(() => ({}));
    const { taskId } = body;
    const proofValue = typeof body.proofValue === "string" ? body.proofValue : "";
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    // ── Anti-fraud: rate limit ────────────────────────────────────────────
    const { allowed: rateOk, remaining } = await checkRateLimit(session.userId);
    if (!rateOk) {
      await log(session.userId, "rate_limit_hit", { taskId, remaining }, "task", taskId);
      return NextResponse.json({
        error: `You've submitted too many missions this hour. Please wait before trying again.`,
      }, { status: 429 });
    }

    // ── Anti-fraud: trust score ───────────────────────────────────────────
    const { allowed: trustOk, trustScore } = await checkTrustScore(session.userId);
    if (!trustOk) {
      await log(session.userId, "fraud_flagged", { taskId, trustScore }, "task", taskId);
      return NextResponse.json({
        error: `Your account has been flagged due to a high rejection rate (trust score: ${trustScore}%). Please contact support.`,
      }, { status: 403 });
    }

    // ── Duplicate check (application layer) ──────────────────────────────
    const isDuplicate = await checkDuplicate(session.userId, taskId);
    if (isDuplicate) {
      return NextResponse.json({ error: "You have already completed this mission." }, { status: 409 });
    }

    const taskRows = await sql`
      SELECT *
      FROM tasks
      WHERE id = ${taskId}
        AND is_active = true
        AND COALESCE(task_status, 'active') = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
    `;
    if (taskRows.length === 0) return NextResponse.json({ error: "Mission not found or no longer active." }, { status: 404 });

    const task = taskRows[0];
    const proofType = task.proof_type ?? "none";
    const parsedProof = parseProofSubmission(proofValue);
    const platformOptions = getCampaignPlatformOptions(task);
    const selectedIds = new Set(parsedProof.selectedPlatforms.map((option) => option.id));
    const selectedPlatformOptions = platformOptions.filter((option) => selectedIds.has(option.id));
    if (platformOptions.length > 0 && selectedPlatformOptions.length === 0) {
      return NextResponse.json({ error: "Select at least one platform completed for this mission." }, { status: 400 });
    }
    const selectedReward = platformOptions.length > 0
      ? selectedPlatformOptions.reduce((total, option) => total + option.rewardQlt, 0)
      : Number(task.reward);
    const storedProofBase = parseStoredProofJson(parsedProof.storedProof);
    const storedProof = storedProofBase
      ? JSON.stringify({
        ...storedProofBase,
        selectedPlatforms: selectedPlatformOptions,
        rewardQlt: selectedReward,
      })
      : null;

    if (proofType !== "none" && !proofValue) {
      return NextResponse.json({ error: "Proof of completion is required." }, { status: 400 });
    }

    // ── Verify proof ──────────────────────────────────────────────────────
    const verification = await verifyProof(proofType, parsedProof.proofForVerification, task.title);
    if (!verification.valid) {
      return NextResponse.json({ error: verification.reason }, { status: 422 });
    }

    // ── Budget check ──────────────────────────────────────────────────────
    const budget = Number(task.total_budget ?? 0);
    const budgetUsed = Number(task.budget_used ?? 0);
    if (budget > 0 && budgetUsed + selectedReward > budget) {
      return NextResponse.json({ error: "This mission has reached its completion limit." }, { status: 410 });
    }

    // ── Daily cap check ───────────────────────────────────────────────────
    const { allowed: capOk } = await checkDailyCap(session.userId, selectedReward);
    if (!capOk) {
      return NextResponse.json({
        error: `Daily earning limit reached. Complete more missions tomorrow or level up to increase your cap.`,
      }, { status: 429 });
    }

    // ── Min level check ───────────────────────────────────────────────────
    const minLevel = Number(task.min_level ?? 1);
    const userLevelRows = await sql`
      SELECT l.level_number, l.unlock_features
      FROM users u
      LEFT JOIN levels l ON l.id = u.level_id
      WHERE u.id = ${session.userId}
    `;
    const userLevel = displayLevel(userLevelRows[0]?.level_number);
    if (userLevel < minLevel) {
      return NextResponse.json({ error: `This mission requires Level ${minLevel}.` }, { status: 403 });
    }

    const allowedTypes = getAllowedMissionTypes(userLevelRows[0]?.unlock_features);
    const missionType = task.mission_type ?? "engagement";
    if (!allowedTypes.has(missionType)) {
      return NextResponse.json({ error: "This mission type is not unlocked for your level yet." }, { status: 403 });
    }

    const qltProgressReward = Number(task.xp_reward ?? QLT_PROGRESS_REWARDS[missionType] ?? 0);

    // ── Insert completion (DB UNIQUE constraint is final guard) ───────────
    try {
      const completionRows = await sql`
        INSERT INTO completions (user_id, task_id, proof_value, status, xp_awarded, qlt_awarded)
        VALUES (${session.userId}, ${taskId}, ${storedProof}, 'pending', ${qltProgressReward}, ${selectedReward})
        RETURNING id
      `;
      await createContributorNotification({
        userId: session.userId,
        type: "submission_received",
        title: "Submission received",
        message: `Your proof for ${task.title} is now pending review.`,
        href: "/tasks",
        dedupeKey: `submission:${completionRows[0].id}:received`,
        metadata: { taskId: Number(taskId), completionId: Number(completionRows[0].id) },
      });
      await syncCampaignSubmissionFromCompletion({
        taskId: Number(taskId),
        completionId: Number(completionRows[0].id),
        contributorId: session.userId,
        proofValue: storedProof,
        rewardAmount: selectedReward,
      });
      if (task.business_id) {
        const userRows = await sql`SELECT full_name FROM users WHERE id = ${session.userId}`;
        await createBusinessNotification({
          businessId: Number(task.business_id),
          type: "participation",
          tone: "gold",
          title: "New proof submitted",
          body: `${userRows[0]?.full_name || "A contributor"} submitted proof for ${task.title}.`,
          status: "Needs review",
          href: `/business/tasks/${taskId}`,
          metadata: { taskId: Number(taskId), completionId: Number(completionRows[0].id), contributorId: session.userId },
        });
      }
    } catch (err: unknown) {
      // Catch DB unique violation
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        return NextResponse.json({ error: "You have already completed this mission." }, { status: 409 });
      }
      throw err;
    }

    // ── Increment rate limit counter ──────────────────────────────────────
    await incrementRateLimit(session.userId);

    // ── Budget tracking ───────────────────────────────────────────────────
    if (budget > 0) {
      await sql`UPDATE tasks SET budget_used = LEAST(total_budget, budget_used + ${selectedReward}) WHERE id = ${taskId}`;
      await sql`UPDATE tasks SET is_active = FALSE WHERE id = ${taskId} AND total_budget > 0 AND budget_used >= total_budget`;
    }

    // ── Streak update ─────────────────────────────────────────────────────
    const { newStreak } = await updateStreak(session.userId);

    // ── Audit log ─────────────────────────────────────────────────────────
    await log(session.userId, "mission_submitted", {
      taskId, missionType, qltProgressReward, reward: selectedReward, selectedPlatforms: selectedPlatformOptions, newStreak,
    }, "task", taskId);

    return NextResponse.json({
      ok: true,
      pending: true,
      reward: selectedReward,
      xpReward: qltProgressReward,
      qltProgressReward,
      missionType,
      newStreak,
      message: "Submission received. Your QLT will be credited after review.",
    });

  } catch (err) {
    console.error("Mission complete error:", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
