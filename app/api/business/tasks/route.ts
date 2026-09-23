import { NextRequest, NextResponse } from "next/server";
import { platformFeatureEnabled } from "@/lib/adminPlatform";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { QLT_PROGRESS_REWARDS } from "@/lib/missionEngine";
import { ensureBusinessWalletTables } from "@/lib/businessWallet";
import { createBusinessNotification } from "@/lib/businessNotifications";
import {
  buildCampaignEngineMetadata,
  calculateMvpCampaignPricing,
  createUniversalCampaignRecords,
  ensureUniversalCampaignTables,
} from "@/lib/universalCampaignEngine";
import { canonicalizeInterests } from "@/lib/interestTaxonomy";
import { expireElapsedMissions } from "@/lib/missionExpiry";

export async function GET(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("search")?.trim() ?? "";
  const status = req.nextUrl.searchParams.get("status")?.trim() ?? "all";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(req.nextUrl.searchParams.get("pageSize")) || 10));
  const offset = (page - 1) * pageSize;
  const searchLike = `%${search}%`;
  const statusLike = status === "active" ? "active" : status;
  await expireElapsedMissions();

  const [tasks, countRows] = await Promise.all([sql`
    SELECT
      t.*,
      t.task_status AS status,
      COUNT(c.id)::int AS total_completions,
      COUNT(CASE WHEN c.status = 'pending'  THEN 1 END)::int AS pending_completions,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END)::int AS approved_completions,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END)::int AS rejected_completions
    FROM tasks t
    LEFT JOIN completions c ON c.task_id = t.id
    WHERE t.business_id = ${session.businessId}
      AND COALESCE(t.task_status, '') <> 'deleted'
      AND (${search} = '' OR t.title ILIKE ${searchLike} OR t.category ILIKE ${searchLike} OR COALESCE(t.mission_type, '') ILIKE ${searchLike})
      AND (${status} = 'all' OR COALESCE(t.task_status, CASE WHEN t.is_active THEN 'active' ELSE 'paused' END) = ${statusLike})
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `, sql`
    SELECT COUNT(*)::int AS count FROM tasks t
    WHERE t.business_id = ${session.businessId}
      AND COALESCE(t.task_status, '') <> 'deleted'
      AND (${search} = '' OR t.title ILIKE ${searchLike} OR t.category ILIKE ${searchLike} OR COALESCE(t.mission_type, '') ILIKE ${searchLike})
      AND (${status} = 'all' OR COALESCE(t.task_status, CASE WHEN t.is_active THEN 'active' ELSE 'paused' END) = ${statusLike})
  `]);

  return NextResponse.json({ tasks, pagination: { page, pageSize, total: Number(countRows[0]?.count ?? 0), pages: Math.max(1, Math.ceil(Number(countRows[0]?.count ?? 0) / pageSize)) } });
}

export async function POST(req: NextRequest) {
  if(!await platformFeatureEnabled("campaignCreation")) return NextResponse.json({error:"Campaign creation is temporarily unavailable"},{status:503});
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    title, category, reward, duration, instructions, steps,
    proof_type, proof_label, max_screenshots, task_link,
    total_budget, target_completion_count,
    mission_type, verification_type, difficulty, min_level,
    target_professions, target_interests, target_platforms, scheduled_start_at,
    target_age_ranges, target_genders, target_countries, target_states,
    campaign_goal, campaign_package, campaign_metadata,
  } = await req.json();
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ`;
  const scheduledStart = scheduled_start_at ? new Date(scheduled_start_at) : null;
  if (scheduledStart && (!Number.isFinite(scheduledStart.getTime()) || scheduledStart.getTime() <= Date.now())) {
    return NextResponse.json({ error: "Scheduled launch must be a valid future date and time" }, { status: 400 });
  }

  const rewardAmount = Number(reward);
  if (!title?.trim() || !category || !Number.isFinite(rewardAmount) || rewardAmount <= 0) {
    return NextResponse.json({ error: "Title, category and a valid reward are required" }, { status: 400 });
  }

  const targetCount = Math.max(0, Number(target_completion_count) || 0);
  const enginePricing = calculateMvpCampaignPricing({
    rewardPerContributorQlt: rewardAmount,
    contributorCount: targetCount,
  });
  const explicitBudget = Math.max(0, Number(total_budget) || 0);
  const resolvedBudget = targetCount > 0 ? enginePricing.totalCostQlt : explicitBudget;
  if (resolvedBudget <= 0) {
    return NextResponse.json({ error: "Campaign budget is required before launch" }, { status: 400 });
  }

  await ensureBusinessWalletTables();
  await ensureUniversalCampaignTables();
  const reservedBudgetRows = await sql`
    UPDATE businesses
    SET balance = balance - ${resolvedBudget}
    WHERE id = ${session.businessId}
      AND balance >= ${resolvedBudget}
    RETURNING balance
  `;
  if (reservedBudgetRows.length === 0) {
    const businessRows = await sql`SELECT balance FROM businesses WHERE id = ${session.businessId}`;
    const balance = Number(businessRows[0]?.balance ?? 0);
    return NextResponse.json({
      error: `Insufficient business balance. Fund at least ${(resolvedBudget - balance).toLocaleString()} more QLT before launching this campaign.`,
      requiredBalance: resolvedBudget,
      currentBalance: balance,
    }, { status: 402 });
  }

  const screenshotLimit = Math.max(1, Math.min(5, Number(max_screenshots) || 1));
  const cleanSteps = Array.isArray(steps)
    ? steps.filter((step) => typeof step === "string" && step.trim()).map((step) => step.trim())
    : [];

  const resolvedMissionType: string = mission_type || (() => {
    if (["Social Media"].includes(category)) return "engagement";
    if (["Survey", "AI Testing"].includes(category)) return "participation";
    return "premium";
  })();

  const resolvedXpReward = QLT_PROGRESS_REWARDS[resolvedMissionType] ?? 0;
  const resolvedVerification = verification_type || proof_type || "screenshot";
  const resolvedDifficulty = difficulty || (resolvedMissionType === "premium" ? "hard" : resolvedMissionType === "participation" ? "medium" : "easy");
  const resolvedMinLevel = min_level || (resolvedMissionType === "premium" ? 2 : 1);
  const resolvedCampaignGoal = typeof campaign_goal === "string" && campaign_goal.trim() ? campaign_goal.trim() : category;
  const resolvedTargetInterests = canonicalizeInterests(target_interests);
  const campaignEngine = buildCampaignEngineMetadata({
    missionCategory: category,
    campaignGoal: resolvedCampaignGoal,
    title: title.trim(),
    actions: cleanSteps,
    platforms: Array.isArray(target_platforms) ? target_platforms : [],
    proofType: resolvedVerification,
    duration: duration || "5 min",
    contributorCount: targetCount,
    rewardQlt: rewardAmount,
    totalCostQlt: resolvedBudget,
    taskLink: task_link || "",
  });
  const campaignStatus = "pending_review";
  campaignEngine.lifecycle.status = "pending_review";
  campaignEngine.lifecycle.reviewRequired = true;
  const clientMetadata = campaign_metadata && typeof campaign_metadata === "object" ? campaign_metadata : {};
  const metadata = {
    ...clientMetadata,
    package: campaign_package || null,
    universalCampaignEngine: campaignEngine,
  };

  try {
    const result = await sql`
    INSERT INTO tasks (
      title, category, reward, duration, icon, color,
      instructions, steps, proof_type, proof_label, max_screenshots,
      task_link, total_budget, target_completion_count,
      mission_type, xp_reward, verification_type, difficulty, min_level,
      target_professions, target_interests, target_platforms,
      target_age_ranges, target_genders, target_countries, target_states,
      business_id, is_active, task_status, scheduled_start_at,
      campaign_status, campaign_goal, campaign_pricing, campaign_metadata
    ) VALUES (
      ${title.trim()}, ${category}, ${rewardAmount},
      ${duration || "5 min"}, ${"📋"}, ${"#111111"},
      ${instructions || ""}, ${cleanSteps}, ${proof_type || "screenshot"},
      ${proof_label || "Upload screenshot as proof"},
      ${screenshotLimit}, ${task_link || ""},
      ${resolvedBudget}, ${targetCount},
      ${resolvedMissionType}, ${resolvedXpReward}, ${resolvedVerification},
      ${resolvedDifficulty}, ${resolvedMinLevel},
      ${target_professions || []}, ${resolvedTargetInterests}, ${target_platforms || []},
      ${target_age_ranges || []}, ${target_genders || []}, ${target_countries || []}, ${target_states || []},
      ${session.businessId}, ${false}, ${campaignStatus}, ${scheduledStart?.toISOString() ?? null},
      ${campaignStatus}, ${resolvedCampaignGoal}, ${JSON.stringify(enginePricing)}::jsonb, ${JSON.stringify(metadata)}::jsonb
    )
    RETURNING id
  `;

  await sql`
    INSERT INTO business_transactions (business_id, type, amount, label, status, provider, reference, metadata)
    VALUES (
      ${session.businessId}, 'debit', ${resolvedBudget}, ${"Campaign budget reserved: " + title.trim()},
      'completed', 'campaign_budget', ${"QXC-" + result[0].id},
      ${JSON.stringify({ taskId: result[0].id, reward: rewardAmount, targetCount, pricing: enginePricing, campaignStatus })}
    )
  `;
  const campaign = await createUniversalCampaignRecords({
    taskId: Number(result[0].id),
    businessId: session.businessId,
    title: title.trim(),
    description: instructions || "",
    missionCategory: category,
    campaignGoal: resolvedCampaignGoal,
    actions: cleanSteps,
    platforms: Array.isArray(target_platforms) ? target_platforms : [],
    targeting: {
      professions: Array.isArray(target_professions) ? target_professions : [],
      interests: resolvedTargetInterests,
      ageRanges: Array.isArray(target_age_ranges) ? target_age_ranges : [],
      genders: Array.isArray(target_genders) ? target_genders : [],
      countries: Array.isArray(target_countries) ? target_countries : [],
      states: Array.isArray(target_states) ? target_states : [],
    },
    pricing: enginePricing,
    metadata,
    engine: campaignEngine,
  });

  await createBusinessNotification({
    businessId: session.businessId,
    type: "verification",
    tone: "gold",
    title: "Campaign submitted for admin verification",
    body: `${title.trim()} is waiting for admin approval. Growth Partners will not see it until verification is completed within 24 hours.`,
    status: "Pending approval",
    href: `/business/tasks/${result[0].id}`,
    metadata: { taskId: result[0].id, campaignId: campaign.campaignId, campaignStatus },
  });

  await createBusinessNotification({
    businessId: session.businessId,
    type: "wallet",
    tone: "purple",
    title: "Campaign budget reserved",
    body: `${resolvedBudget.toLocaleString()} QLT has been reserved for ${title.trim()}.`,
    status: "Budget reserved",
    href: "/business/wallet",
    metadata: { taskId: result[0].id, campaignId: campaign.campaignId, amount: resolvedBudget },
  });

    return NextResponse.json({ ok: true, taskId: result[0].id, campaignId: campaign.campaignId, missionType: resolvedMissionType, campaignStatus, pricing: enginePricing });
  } catch (error) {
    await sql`UPDATE businesses SET balance = balance + ${resolvedBudget} WHERE id = ${session.businessId}`;
    throw error;
  }
}
