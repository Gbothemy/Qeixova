import { sql } from "@/lib/db";
import { QLT_PER_NAIRA } from "@/lib/currency";
import { getBusinessPlatformRewardQlt } from "@/lib/campaignPlatformPricing";
import { activateMissionExpiryByTask, ensureMissionExpiryColumns } from "@/lib/missionExpiry";

export const MIN_REWARD_NAIRA = 30;
export const QEIXOVA_COMMISSION_RATE = 0.2;
export const VERIFICATION_FEE_RATE = 0.1;

export type CampaignStatus =
  | "draft"
  | "pending_funding"
  | "pending_review"
  | "live"
  | "paused"
  | "completed"
  | "expired"
  | "closed"
  | "rejected";

export type CampaignClaimStatus = "active" | "completed" | "expired" | "cancelled" | "blocked";
export type CampaignSubmissionStatus =
  | "claimed"
  | "in_progress"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_correction"
  | "disputed"
  | "expired";

type MissionCategoryKey = "content" | "music" | "community" | "apps" | "surveys";

type EngineInput = {
  missionCategory: string;
  campaignGoal?: string;
  contentType?: string;
  bundleId?: string;
  title?: string;
  actions?: string[];
  platforms?: string[];
  proofType?: string;
  duration?: string;
  contributorCount: number;
  rewardQlt: number;
  totalCostQlt: number;
  taskLink?: string;
  businessTrustLevel?: "new" | "trusted";
};

type CreateCampaignRecordsInput = {
  taskId: number;
  businessId: number;
  title: string;
  description: string;
  missionCategory: string;
  campaignGoal: string;
  actions: string[];
  platforms: string[];
  targeting: {
    professions: string[];
    interests: string[];
    ageRanges: string[];
    genders: string[];
    countries: string[];
    states: string[];
  };
  pricing: CampaignPricing;
  metadata: Record<string, unknown>;
  engine: ReturnType<typeof buildCampaignEngineMetadata>;
};

type CampaignAnalytics = {
  totalSlots: number;
  claimedSlots: number;
  submittedCount: number;
  approvedCount: number;
  rejectedCount: number;
  disputedCount: number;
  completionRate: number;
  approvalRate: number;
  rewardSpend: number;
  remainingBudget: number;
  healthScore: number;
};

export type CampaignPricing = {
  version: "mvp-naira-v1";
  qltPerNaira: number;
  rewardPerContributorNaira: number;
  rewardPerContributorQlt: number;
  contributorCount: number;
  contributorRewardsNaira: number;
  contributorRewardsQlt: number;
  commissionRate: number;
  commissionAmountNaira: number;
  commissionAmountQlt: number;
  verificationRate: number;
  verificationAmountNaira: number;
  verificationAmountQlt: number;
  totalCostNaira: number;
  totalCostQlt: number;
};

const missionModules: Record<MissionCategoryKey, {
  name: string;
  goals: string[];
  recommendedActions: string[];
  recommendedVerification: string;
  timerPreset: {
    claimTimerMinutes: number;
    completionTimerMinutes: number;
    proofSubmissionWindowMinutes: number;
    durationRequirementHours: number;
    retentionRequirementHours: number;
  };
  reviewRequired: boolean;
}> = {
  content: {
    name: "Content Distribution",
    goals: ["Brand Awareness", "Event Awareness", "Creator Content Promotion", "Product Promotion"],
    recommendedActions: ["Post content", "Keep content visible", "Submit screenshot proof"],
    recommendedVerification: "screenshot",
    timerPreset: { claimTimerMinutes: 30, completionTimerMinutes: 120, proofSubmissionWindowMinutes: 120, durationRequirementHours: 24, retentionRequirementHours: 0 },
    reviewRequired: false,
  },
  music: {
    name: "Music Promotion",
    goals: ["New Song Awareness", "Snippet Promotion", "Streaming Awareness", "Music Video Promotion"],
    recommendedActions: ["Listen or stream", "Share music content", "Submit screenshot or link proof"],
    recommendedVerification: "screenshot_link",
    timerPreset: { claimTimerMinutes: 30, completionTimerMinutes: 180, proofSubmissionWindowMinutes: 120, durationRequirementHours: 24, retentionRequirementHours: 0 },
    reviewRequired: false,
  },
  community: {
    name: "Community Growth",
    goals: ["New Community Launch", "Increase Members", "Targeted Member Acquisition"],
    recommendedActions: ["Join community", "Complete onboarding", "Submit join and retention proof"],
    recommendedVerification: "dual_proof",
    timerPreset: { claimTimerMinutes: 30, completionTimerMinutes: 240, proofSubmissionWindowMinutes: 120, durationRequirementHours: 0, retentionRequirementHours: 72 },
    reviewRequired: true,
  },
  apps: {
    name: "App Testing",
    goals: ["Install & Open Test", "Signup / Onboarding Test", "Bug Discovery", "Feature Testing"],
    recommendedActions: ["Install or open app", "Complete test steps", "Submit feedback and proof"],
    recommendedVerification: "screenshot_feedback",
    timerPreset: { claimTimerMinutes: 30, completionTimerMinutes: 360, proofSubmissionWindowMinutes: 180, durationRequirementHours: 0, retentionRequirementHours: 0 },
    reviewRequired: true,
  },
  surveys: {
    name: "Feedback Campaign",
    goals: ["Product Feedback", "Content Feedback", "Survey & Opinions", "Feature Validation"],
    recommendedActions: ["Read instructions", "Answer feedback questions", "Submit response"],
    recommendedVerification: "text_response",
    timerPreset: { claimTimerMinutes: 30, completionTimerMinutes: 180, proofSubmissionWindowMinutes: 120, durationRequirementHours: 0, retentionRequirementHours: 0 },
    reviewRequired: false,
  },
};

export const campaignStatusTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["pending_funding", "rejected"],
  pending_funding: ["pending_review", "live", "rejected"],
  pending_review: ["live", "rejected"],
  live: ["paused", "completed", "expired", "closed"],
  paused: ["live", "completed", "expired", "closed"],
  completed: ["closed"],
  expired: ["closed"],
  closed: [],
  rejected: ["draft"],
};

const highRiskTerms = ["crypto", "loan", "investment", "betting", "gambling", "political", "adult", "medicine", "health claim"];

export function toQlt(naira: number) {
  return Math.round(naira * QLT_PER_NAIRA);
}

function toNaira(qlt: number) {
  return Math.round(qlt / QLT_PER_NAIRA);
}

function normalizeMissionCategory(category: string): MissionCategoryKey {
  const value = category.toLowerCase();
  if (value.includes("music")) return "music";
  if (value.includes("community")) return "community";
  if (value.includes("app") || value.includes("testing")) return "apps";
  if (value.includes("feedback") || value.includes("survey")) return "surveys";
  return "content";
}

export function getMissionModule(category: string) {
  return missionModules[normalizeMissionCategory(category)];
}

export function calculateMvpCampaignPricing(input: {
  rewardPerContributorNaira?: number;
  rewardPerContributorQlt?: number;
  contributorCount: number;
}): CampaignPricing {
  const fromQlt = input.rewardPerContributorQlt ? toNaira(input.rewardPerContributorQlt) : 0;
  const rewardPerContributorNaira = Math.max(MIN_REWARD_NAIRA, Math.round(input.rewardPerContributorNaira || fromQlt));
  const contributorCount = Math.max(0, Math.round(input.contributorCount));
  const contributorRewardsNaira = rewardPerContributorNaira * contributorCount;
  const commissionAmountNaira = Math.round(contributorRewardsNaira * QEIXOVA_COMMISSION_RATE);
  const verificationAmountNaira = Math.round(contributorRewardsNaira * VERIFICATION_FEE_RATE);
  const totalCostNaira = contributorRewardsNaira + commissionAmountNaira + verificationAmountNaira;

  return {
    version: "mvp-naira-v1",
    qltPerNaira: QLT_PER_NAIRA,
    rewardPerContributorNaira,
    rewardPerContributorQlt: toQlt(rewardPerContributorNaira),
    contributorCount,
    contributorRewardsNaira,
    contributorRewardsQlt: toQlt(contributorRewardsNaira),
    commissionRate: QEIXOVA_COMMISSION_RATE,
    commissionAmountNaira,
    commissionAmountQlt: toQlt(commissionAmountNaira),
    verificationRate: VERIFICATION_FEE_RATE,
    verificationAmountNaira,
    verificationAmountQlt: toQlt(verificationAmountNaira),
    totalCostNaira,
    totalCostQlt: toQlt(totalCostNaira),
  };
}

export function getRecommendedVerification(input: Pick<EngineInput, "missionCategory" | "proofType" | "actions">) {
  const missionModule = getMissionModule(input.missionCategory);
  const hasFeedback = (input.actions || []).some((action) => action.toLowerCase().includes("feedback"));
  const proofType = input.proofType || (hasFeedback ? "text" : missionModule.recommendedVerification);

  return {
    verificationType: proofType,
    proofRequired: proofType !== "none",
    proofCount: proofType === "dual_proof" ? 2 : 1,
    requiresManualReview: proofType !== "none",
    requiresDualProof: proofType === "dual_proof" || missionModule.recommendedVerification === "dual_proof",
    requiresAdminConfirmation: false,
    autoCheckEnabled: false,
  };
}

export function getRecommendedTimers(input: Pick<EngineInput, "missionCategory" | "duration">) {
  const missionModule = getMissionModule(input.missionCategory);
  const durationValue = input.duration || "";
  const dayMatch = durationValue.match(/(\d+)\s*day/i);
  const campaignDays = dayMatch ? Number(dayMatch[1]) : 3;
  const campaignExpiryAt = new Date(Date.now() + campaignDays * 24 * 60 * 60 * 1000).toISOString();

  return {
    ...missionModule.timerPreset,
    campaignExpiryAt,
    cooldownMinutes: 0,
    returnTimerHours: normalizeMissionCategory(input.missionCategory) === "apps" ? 24 : 0,
  };
}

export function requiresManualReview(input: Pick<EngineInput, "missionCategory" | "taskLink" | "businessTrustLevel" | "totalCostQlt">) {
  const missionModule = getMissionModule(input.missionCategory);
  const link = input.taskLink || "";
  const hasExternalLink = /^https?:\/\//i.test(link);
  const hasDownloadRisk = /\.(apk|exe|dmg|zip)(\?|$)/i.test(link);
  const highBudget = input.totalCostQlt >= 500000;
  const newBusiness = input.businessTrustLevel !== "trusted";

  return missionModule.reviewRequired || hasDownloadRisk || (hasExternalLink && newBusiness) || highBudget;
}

export function validateCampaignReadiness(input: Pick<EngineInput, "title" | "missionCategory" | "campaignGoal" | "actions" | "platforms" | "contributorCount" | "rewardQlt" | "totalCostQlt">) {
  const checks = [
    { key: "category", label: "Mission category selected", ready: Boolean(input.missionCategory) },
    { key: "goal", label: "Campaign goal selected", ready: Boolean(input.campaignGoal) },
    { key: "title", label: "Campaign title added", ready: Boolean(input.title?.trim()) },
    { key: "actions", label: "Contributor actions configured", ready: Boolean(input.actions?.length) },
    { key: "platforms", label: "Target platforms selected", ready: Boolean(input.platforms?.length) },
    { key: "contributors", label: "Contributor quantity selected", ready: input.contributorCount > 0 },
    { key: "reward", label: "Contributor reward meets minimum", ready: input.rewardQlt >= toQlt(MIN_REWARD_NAIRA) },
    { key: "pricing", label: "Pricing calculated", ready: input.totalCostQlt > 0 },
  ];

  return {
    checks,
    ready: checks.every((check) => check.ready),
    readyCount: checks.filter((check) => check.ready).length,
    totalCount: checks.length,
  };
}

export function canTransitionCampaignStatus(current: CampaignStatus, next: CampaignStatus) {
  return campaignStatusTransitions[current].includes(next);
}

export function calculateCampaignQualityScore(input: Pick<EngineInput, "title" | "campaignGoal" | "actions" | "platforms" | "rewardQlt" | "taskLink"> & {
  description?: string;
  verificationType?: string;
  contributorCount?: number;
}) {
  let score = 100;
  const suggestions: string[] = [];
  const combinedText = `${input.title || ""} ${input.campaignGoal || ""} ${input.description || ""}`.toLowerCase();

  if (!input.title || input.title.trim().length < 8) {
    score -= 12;
    suggestions.push("Add a clearer campaign title.");
  }
  if (!input.description || input.description.trim().length < 40) {
    score -= 12;
    suggestions.push("Add clearer contributor instructions.");
  }
  if (!input.actions?.length) {
    score -= 18;
    suggestions.push("Add at least one contributor action.");
  }
  if (!input.platforms?.length) {
    score -= 8;
    suggestions.push("Choose at least one platform or audience channel.");
  }
  if (input.rewardQlt < toQlt(MIN_REWARD_NAIRA)) {
    score -= 20;
    suggestions.push("Increase the contributor reward to the platform minimum.");
  }
  if (!input.verificationType || input.verificationType === "none") {
    score -= 14;
    suggestions.push("Add a verification method before launch.");
  }
  if (highRiskTerms.some((term) => combinedText.includes(term))) {
    score -= 16;
    suggestions.push("Submit this campaign for manual safety review.");
  }
  if (input.taskLink && !/^https?:\/\//i.test(input.taskLink)) {
    score -= 6;
    suggestions.push("Use a complete link that starts with http or https.");
  }

  const label = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Needs Improvement" : "Not Ready";
  return { score: Math.max(0, score), label, suggestions };
}

export function buildCampaignEngineMetadata(input: EngineInput) {
  const missionModule = getMissionModule(input.missionCategory);
  const pricing = calculateMvpCampaignPricing({
    rewardPerContributorQlt: input.rewardQlt,
    contributorCount: input.contributorCount,
  });
  const verification = getRecommendedVerification(input);
  const timers = getRecommendedTimers(input);
  const readiness = validateCampaignReadiness(input);
  const quality = calculateCampaignQualityScore({
    ...input,
    description: input.actions?.join(" "),
    verificationType: verification.verificationType,
  });
  const reviewRequired = requiresManualReview({ ...input, totalCostQlt: pricing.totalCostQlt });

  return {
    engineVersion: "universal-campaign-engine-mvp-v1",
    missionModule: missionModule.name,
    lifecycle: {
      status: reviewRequired ? "pending_review" : "live" as CampaignStatus,
      reviewRequired,
      allowedStatuses: ["draft", "pending_funding", "pending_review", "live", "paused", "completed", "closed", "rejected"] satisfies CampaignStatus[],
    },
    module: {
      goals: missionModule.goals,
      recommendedActions: missionModule.recommendedActions,
      recommendedVerification: missionModule.recommendedVerification,
    },
    pricing,
    verification,
    timers,
    readiness,
    quality,
  };
}

export async function ensureUniversalCampaignTaskColumns() {
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_status TEXT NOT NULL DEFAULT 'pending_review'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_goal TEXT NOT NULL DEFAULT ''`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_pricing JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS campaign_metadata JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_professions TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_interests TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_platforms TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_age_ranges TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_genders TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_countries TEXT[] NOT NULL DEFAULT '{}'`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_states TEXT[] NOT NULL DEFAULT '{}'`;
  await ensureMissionExpiryColumns();
}

export async function ensureUniversalCampaignTables() {
  await ensureUniversalCampaignTaskColumns();

  await sql`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      task_id INTEGER UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
      business_id INTEGER NOT NULL,
      mission_category TEXT NOT NULL,
      campaign_goal TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_review',
      start_date TIMESTAMPTZ,
      end_date TIMESTAMPTZ,
      total_slots INTEGER NOT NULL DEFAULT 0,
      filled_slots INTEGER NOT NULL DEFAULT 0,
      completed_slots INTEGER NOT NULL DEFAULT 0,
      approved_slots INTEGER NOT NULL DEFAULT 0,
      rejected_slots INTEGER NOT NULL DEFAULT 0,
      total_budget INTEGER NOT NULL DEFAULT 0,
      available_budget INTEGER NOT NULL DEFAULT 0,
      reserved_budget INTEGER NOT NULL DEFAULT 0,
      spent_budget INTEGER NOT NULL DEFAULT 0,
      platform_commission INTEGER NOT NULL DEFAULT 0,
      verification_fee INTEGER NOT NULL DEFAULT 0,
      targeting_fee INTEGER NOT NULL DEFAULT 0,
      quality_premium INTEGER NOT NULL DEFAULT 0,
      pricing JSONB NOT NULL DEFAULT '{}'::jsonb,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_actions (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      action_type TEXT NOT NULL DEFAULT 'mission_step',
      platform TEXT NOT NULL DEFAULT 'All platforms',
      title TEXT NOT NULL,
      instruction TEXT NOT NULL,
      action_order INTEGER NOT NULL DEFAULT 1,
      is_required BOOLEAN NOT NULL DEFAULT TRUE,
      requires_proof BOOLEAN NOT NULL DEFAULT TRUE,
      proof_type TEXT NOT NULL DEFAULT 'screenshot',
      reward_weight NUMERIC NOT NULL DEFAULT 1,
      estimated_minutes INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_platforms (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      bundle_type TEXT NOT NULL DEFAULT 'standard',
      slots_allocated INTEGER NOT NULL DEFAULT 0,
      slots_filled INTEGER NOT NULL DEFAULT 0,
      reward_per_slot INTEGER NOT NULL DEFAULT 0,
      verification_type TEXT NOT NULL DEFAULT 'screenshot',
      duration_requirement INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_targeting (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      location JSONB NOT NULL DEFAULT '[]'::jsonb,
      country JSONB NOT NULL DEFAULT '[]'::jsonb,
      language JSONB NOT NULL DEFAULT '[]'::jsonb,
      interests JSONB NOT NULL DEFAULT '[]'::jsonb,
      contributor_level JSONB NOT NULL DEFAULT '[]'::jsonb,
      device_type JSONB NOT NULL DEFAULT '[]'::jsonb,
      platform_requirement JSONB NOT NULL DEFAULT '[]'::jsonb,
      age_range JSONB NOT NULL DEFAULT '[]'::jsonb,
      reputation_minimum INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE campaign_targeting ADD COLUMN IF NOT EXISTS country JSONB NOT NULL DEFAULT '[]'::jsonb`;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_verification_rules (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      verification_type TEXT NOT NULL,
      proof_required BOOLEAN NOT NULL DEFAULT TRUE,
      proof_count INTEGER NOT NULL DEFAULT 1,
      requires_manual_review BOOLEAN NOT NULL DEFAULT TRUE,
      requires_dual_proof BOOLEAN NOT NULL DEFAULT FALSE,
      requires_admin_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
      auto_check_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_timers (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      claim_timer_minutes INTEGER NOT NULL DEFAULT 30,
      completion_timer_minutes INTEGER NOT NULL DEFAULT 120,
      proof_submission_window_minutes INTEGER NOT NULL DEFAULT 120,
      campaign_expiry_at TIMESTAMPTZ,
      cooldown_minutes INTEGER NOT NULL DEFAULT 0,
      duration_requirement_hours INTEGER NOT NULL DEFAULT 0,
      retention_requirement_hours INTEGER NOT NULL DEFAULT 0,
      return_timer_hours INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_claims (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contributor_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      claimed_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(campaign_id, contributor_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_submissions (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contributor_id INTEGER NOT NULL,
      claim_id INTEGER REFERENCES campaign_claims(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      review_note TEXT NOT NULL DEFAULT '',
      reward_amount INTEGER NOT NULL DEFAULT 0,
      quality_score INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_proofs (
      id SERIAL PRIMARY KEY,
      submission_id INTEGER NOT NULL REFERENCES campaign_submissions(id) ON DELETE CASCADE,
      proof_type TEXT NOT NULL,
      proof_url TEXT NOT NULL DEFAULT '',
      proof_text TEXT NOT NULL DEFAULT '',
      proof_link TEXT NOT NULL DEFAULT '',
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_wallets (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER UNIQUE NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      business_id INTEGER NOT NULL,
      funded_amount INTEGER NOT NULL DEFAULT 0,
      reserved_rewards INTEGER NOT NULL DEFAULT 0,
      released_rewards INTEGER NOT NULL DEFAULT 0,
      refunded_amount INTEGER NOT NULL DEFAULT 0,
      platform_earned INTEGER NOT NULL DEFAULT 0,
      available_balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_transactions (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id INTEGER,
      transaction_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      reference TEXT UNIQUE,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_templates (
      id SERIAL PRIMARY KEY,
      template_key TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      mission_category TEXT NOT NULL,
      campaign_goal TEXT NOT NULL,
      default_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_reward_qlt INTEGER NOT NULL DEFAULT 300,
      default_contributors INTEGER NOT NULL DEFAULT 50,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_disputes (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      submission_id INTEGER REFERENCES campaign_submissions(id) ON DELETE SET NULL,
      opened_by_user_id INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaign_notifications (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      recipient_type TEXT NOT NULL,
      recipient_id INTEGER,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_business_id ON campaigns(business_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, end_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_mission_discovery ON tasks(campaign_status, task_status, expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_target_interests ON tasks USING GIN(target_interests)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_target_states ON tasks USING GIN(target_states)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_target_countries ON tasks USING GIN(target_countries)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_actions_campaign_id ON campaign_actions(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_claims_campaign_id ON campaign_claims(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_submissions_campaign_id ON campaign_submissions(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_disputes_campaign_id ON campaign_disputes(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_campaign_notifications_recipient ON campaign_notifications(recipient_type, recipient_id)`;

  const templates = [
    { key: "promote-song", title: "Promote My Song", category: "Music Promotion", goal: "New Song Awareness", reward: 1000, contributors: 100, actions: ["Listen to the song", "Share the music link", "Submit screenshot and short reaction"], platforms: ["WhatsApp Status", "Instagram Story"] },
    { key: "grow-whatsapp-group", title: "Grow My WhatsApp Group", category: "Community Growth", goal: "Increase Members", reward: 800, contributors: 100, actions: ["Join community", "Read community rules", "Submit join proof"], platforms: ["WhatsApp"] },
    { key: "test-app", title: "Test My App", category: "App Testing", goal: "Install & Open Test", reward: 1500, contributors: 25, actions: ["Install or open app", "Use the app", "Submit feedback and screenshot"], platforms: ["Android", "iOS"] },
    { key: "promote-event", title: "Promote My Event", category: "Content Distribution", goal: "Event Awareness", reward: 500, contributors: 100, actions: ["Post event flyer", "Keep it visible", "Submit screenshot proof"], platforms: ["WhatsApp Status", "Facebook Story", "Instagram Story"] },
    { key: "collect-product-feedback", title: "Collect Product Feedback", category: "Feedback Campaign", goal: "Product Feedback", reward: 1200, contributors: 50, actions: ["Review product information", "Answer feedback questions", "Submit response"], platforms: ["Feedback Form"] },
    { key: "promote-business-flyer", title: "Promote My Business Flyer", category: "Content Distribution", goal: "Brand Awareness", reward: 300, contributors: 50, actions: ["Post flyer", "Keep it visible", "Submit screenshot proof"], platforms: ["WhatsApp Status", "Facebook Story"] },
  ];

  for (const template of templates) {
    await sql`
      INSERT INTO campaign_templates (
        template_key, title, mission_category, campaign_goal, default_actions,
        default_platforms, default_reward_qlt, default_contributors, metadata
      ) VALUES (
        ${template.key}, ${template.title}, ${template.category}, ${template.goal},
        ${JSON.stringify(template.actions)}::jsonb, ${JSON.stringify(template.platforms)}::jsonb,
        ${template.reward}, ${template.contributors}, ${JSON.stringify({ source: "mvp_seed" })}::jsonb
      )
      ON CONFLICT (template_key) DO UPDATE SET
        title = EXCLUDED.title,
        mission_category = EXCLUDED.mission_category,
        campaign_goal = EXCLUDED.campaign_goal,
        default_actions = EXCLUDED.default_actions,
        default_platforms = EXCLUDED.default_platforms,
        default_reward_qlt = EXCLUDED.default_reward_qlt,
        default_contributors = EXCLUDED.default_contributors,
        updated_at = NOW()
    `;
  }
}

export async function createUniversalCampaignRecords(input: CreateCampaignRecordsInput) {
  await ensureUniversalCampaignTables();
  const verification = input.engine.verification;
  const timers = input.engine.timers;
  const campaignRows = await sql`
    INSERT INTO campaigns (
      task_id, business_id, mission_category, campaign_goal, title, description, status,
      total_slots, total_budget, available_budget, reserved_budget,
      platform_commission, verification_fee, pricing, metadata
    ) VALUES (
      ${input.taskId}, ${input.businessId}, ${input.missionCategory}, ${input.campaignGoal},
      ${input.title}, ${input.description}, ${input.engine.lifecycle.status},
      ${input.pricing.contributorCount}, ${input.pricing.totalCostQlt}, 0,
      ${input.pricing.contributorRewardsQlt}, ${input.pricing.commissionAmountQlt},
      ${input.pricing.verificationAmountQlt}, ${JSON.stringify(input.pricing)}::jsonb,
      ${JSON.stringify(input.metadata)}::jsonb
    )
    ON CONFLICT (task_id) DO UPDATE SET
      status = EXCLUDED.status,
      total_slots = EXCLUDED.total_slots,
      total_budget = EXCLUDED.total_budget,
      reserved_budget = EXCLUDED.reserved_budget,
      platform_commission = EXCLUDED.platform_commission,
      verification_fee = EXCLUDED.verification_fee,
      pricing = EXCLUDED.pricing,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING id
  `;
  const campaignId = Number(campaignRows[0].id);
  const platforms = input.platforms.length ? input.platforms : ["All platforms"];
  const actions = input.actions.length ? input.actions : input.engine.module.recommendedActions;
  const rewardWeight = actions.length ? 1 / actions.length : 1;
  const estimatedMinutes = Math.max(1, Math.round(timers.completionTimerMinutes / Math.max(1, actions.length)));
  const platformPricingOptions = Array.isArray(input.metadata.selectedPricingOptions)
    ? input.metadata.selectedPricingOptions
      .filter((option): option is { label?: string; platform?: string; rewardQlt?: number } => (
        Boolean(option)
        && typeof option === "object"
        && ("platform" in option || "label" in option)
      ))
      .map((option) => ({
        label: typeof option.label === "string" ? option.label : "",
        platform: typeof option.platform === "string" ? option.platform : "",
        rewardQlt: Math.max(0, Math.round(Number(option.rewardQlt) || 0)),
      }))
    : [];
  const rewardForPlatform = (platform: string) => {
    const normalized = platform.trim().toLowerCase();
    const pricing = platformPricingOptions.find((option) => (
      option.platform.trim().toLowerCase() === normalized
      || option.label.trim().toLowerCase() === normalized
    ));
    return pricing?.rewardQlt || getBusinessPlatformRewardQlt(platform) || input.pricing.rewardPerContributorQlt;
  };

  for (const [index, action] of actions.entries()) {
    await sql`
      INSERT INTO campaign_actions (
        campaign_id, action_type, platform, title, instruction, action_order,
        requires_proof, proof_type, reward_weight, estimated_minutes
      ) VALUES (
        ${campaignId}, 'mission_step', ${platforms[index % platforms.length]},
        ${action}, ${action}, ${index + 1}, ${verification.proofRequired},
        ${verification.verificationType}, ${rewardWeight}, ${estimatedMinutes}
      )
    `;
  }

  for (const platform of platforms) {
    await sql`
      INSERT INTO campaign_platforms (
        campaign_id, platform, bundle_type, slots_allocated, reward_per_slot,
        verification_type, duration_requirement
      ) VALUES (
        ${campaignId}, ${platform}, 'standard',
        ${Math.ceil(input.pricing.contributorCount / platforms.length)},
        ${rewardForPlatform(platform)}, ${verification.verificationType},
        ${timers.durationRequirementHours}
      )
    `;
  }

  await sql`
    INSERT INTO campaign_targeting (
      campaign_id, country, location, interests, contributor_level, platform_requirement, age_range
    ) VALUES (
      ${campaignId}, ${JSON.stringify(input.targeting.countries)}::jsonb,
      ${JSON.stringify(input.targeting.states)}::jsonb,
      ${JSON.stringify(input.targeting.interests)}::jsonb,
      ${JSON.stringify(input.targeting.professions)}::jsonb,
      ${JSON.stringify(platforms)}::jsonb,
      ${JSON.stringify(input.targeting.ageRanges)}::jsonb
    )
  `;

  await sql`
    INSERT INTO campaign_verification_rules (
      campaign_id, verification_type, proof_required, proof_count,
      requires_manual_review, requires_dual_proof, requires_admin_confirmation, auto_check_enabled
    ) VALUES (
      ${campaignId}, ${verification.verificationType}, ${verification.proofRequired},
      ${verification.proofCount}, ${verification.requiresManualReview},
      ${verification.requiresDualProof}, ${verification.requiresAdminConfirmation},
      ${verification.autoCheckEnabled}
    )
  `;

  await sql`
    INSERT INTO campaign_timers (
      campaign_id, claim_timer_minutes, completion_timer_minutes,
      proof_submission_window_minutes, campaign_expiry_at, cooldown_minutes,
      duration_requirement_hours, retention_requirement_hours, return_timer_hours
    ) VALUES (
      ${campaignId}, ${timers.claimTimerMinutes}, ${timers.completionTimerMinutes},
      ${timers.proofSubmissionWindowMinutes}, ${timers.campaignExpiryAt}::timestamptz,
      ${timers.cooldownMinutes}, ${timers.durationRequirementHours},
      ${timers.retentionRequirementHours}, ${timers.returnTimerHours}
    )
  `;

  await sql`
    INSERT INTO campaign_wallets (
      campaign_id, business_id, funded_amount, reserved_rewards,
      released_rewards, refunded_amount, platform_earned, available_balance
    ) VALUES (
      ${campaignId}, ${input.businessId}, ${input.pricing.totalCostQlt},
      ${input.pricing.contributorRewardsQlt}, 0, 0,
      ${input.pricing.commissionAmountQlt}, 0
    )
    ON CONFLICT (campaign_id) DO UPDATE SET
      funded_amount = EXCLUDED.funded_amount,
      reserved_rewards = EXCLUDED.reserved_rewards,
      platform_earned = EXCLUDED.platform_earned,
      updated_at = NOW()
  `;

  const referenceBase = `QXC-${campaignId}`;
  await sql`
    INSERT INTO campaign_transactions (campaign_id, user_id, transaction_type, amount, status, reference, metadata)
    VALUES (${campaignId}, ${input.businessId}, 'fund_campaign', ${input.pricing.totalCostQlt}, 'completed', ${referenceBase + "-FUND"}, ${JSON.stringify({ taskId: input.taskId })}::jsonb)
    ON CONFLICT (reference) DO NOTHING
  `;
  await sql`
    INSERT INTO campaign_transactions (campaign_id, user_id, transaction_type, amount, status, reference, metadata)
    VALUES (${campaignId}, ${input.businessId}, 'platform_commission', ${input.pricing.commissionAmountQlt}, 'reserved', ${referenceBase + "-COMMISSION"}, ${JSON.stringify({ rate: input.pricing.commissionRate })}::jsonb)
    ON CONFLICT (reference) DO NOTHING
  `;
  await sql`
    INSERT INTO campaign_transactions (campaign_id, user_id, transaction_type, amount, status, reference, metadata)
    VALUES (${campaignId}, ${input.businessId}, 'verification_fee', ${input.pricing.verificationAmountQlt}, 'reserved', ${referenceBase + "-VERIFY"}, ${JSON.stringify({ rate: input.pricing.verificationRate })}::jsonb)
    ON CONFLICT (reference) DO NOTHING
  `;

  return { campaignId };
}

export async function claimCampaignSlot(input: { campaignId: number; contributorId: number }) {
  await ensureUniversalCampaignTables();
  const campaignRows = await sql`
    SELECT id, status, total_slots, filled_slots
    FROM campaigns
    WHERE id = ${input.campaignId}
  `;
  if (campaignRows.length === 0) return { ok: false, error: "Campaign not found", status: 404 };
  const campaign = campaignRows[0];
  if (campaign.status !== "live") return { ok: false, error: "Campaign is not live", status: 409 };
  if (Number(campaign.filled_slots) >= Number(campaign.total_slots)) return { ok: false, error: "Campaign slots are full", status: 410 };

  const activeClaims = await sql`
    SELECT COUNT(*)::int AS count
    FROM campaign_claims
    WHERE contributor_id = ${input.contributorId}
      AND status IN ('active', 'in_progress')
  `;
  if (Number(activeClaims[0]?.count ?? 0) >= 5) return { ok: false, error: "Claim limit reached", status: 429 };

  const timerRows = await sql`SELECT claim_timer_minutes FROM campaign_timers WHERE campaign_id = ${input.campaignId} LIMIT 1`;
  const claimMinutes = Number(timerRows[0]?.claim_timer_minutes ?? 30);
  const claimRows = await sql`
    INSERT INTO campaign_claims (campaign_id, contributor_id, status, expires_at)
    VALUES (${input.campaignId}, ${input.contributorId}, 'active', NOW() + (${claimMinutes} || ' minutes')::interval)
    ON CONFLICT (campaign_id, contributor_id) DO NOTHING
    RETURNING id, expires_at
  `;
  if (claimRows.length === 0) return { ok: false, error: "You have already claimed this campaign", status: 409 };

  await sql`UPDATE campaigns SET filled_slots = filled_slots + 1, updated_at = NOW() WHERE id = ${input.campaignId}`;
  return { ok: true, claimId: Number(claimRows[0].id), expiresAt: claimRows[0].expires_at };
}

export async function syncCampaignSubmissionFromCompletion(input: {
  taskId: number;
  completionId: number;
  contributorId: number;
  proofValue: string | null;
  rewardAmount: number;
}) {
  await ensureUniversalCampaignTables();
  const campaignRows = await sql`SELECT id FROM campaigns WHERE task_id = ${input.taskId} LIMIT 1`;
  if (campaignRows.length === 0) return { campaignSubmissionId: null };
  const campaignId = Number(campaignRows[0].id);
  const existingSubmissionRows = await sql`
    SELECT cs.id
    FROM campaign_submissions cs
    JOIN campaign_proofs cp ON cp.submission_id = cs.id
    WHERE cs.campaign_id = ${campaignId}
      AND cs.contributor_id = ${input.contributorId}
      AND cp.metadata->>'completionId' = ${String(input.completionId)}
    ORDER BY cs.id DESC
    LIMIT 1
  `;
  if (existingSubmissionRows.length > 0) {
    const campaignSubmissionId = Number(existingSubmissionRows[0].id);
    await sql`
      UPDATE campaign_submissions
      SET status = 'under_review', reward_amount = ${input.rewardAmount},
          reviewed_at = NULL, approved_at = NULL, rejected_at = NULL,
          review_note = '', updated_at = NOW()
      WHERE id = ${campaignSubmissionId}
        AND status = 'rejected'
    `;
    await sql`
      INSERT INTO campaign_proofs (submission_id, proof_type, proof_text, metadata, status)
      VALUES (
        ${campaignSubmissionId}, 'submission_proof', ${input.proofValue || ""},
        ${JSON.stringify({ completionId: input.completionId, retry: true })}::jsonb, 'pending'
      )
    `;
    return { campaignSubmissionId, campaignId };
  }
  const claimRows = await sql`
    SELECT id FROM campaign_claims
    WHERE campaign_id = ${campaignId}
      AND contributor_id = ${input.contributorId}
      AND status IN ('active', 'in_progress')
    ORDER BY claimed_at DESC
    LIMIT 1
  `;
  const claimId = claimRows[0]?.id ? Number(claimRows[0].id) : null;
  const submissionRows = await sql`
    INSERT INTO campaign_submissions (
      campaign_id, contributor_id, claim_id, status, reward_amount, quality_score
    ) VALUES (
      ${campaignId}, ${input.contributorId}, ${claimId}, 'under_review', ${input.rewardAmount}, 0
    )
    RETURNING id
  `;
  const campaignSubmissionId = Number(submissionRows[0].id);
  await sql`
    INSERT INTO campaign_proofs (submission_id, proof_type, proof_text, metadata, status)
    VALUES (
      ${campaignSubmissionId}, 'submission_proof', ${input.proofValue || ""},
      ${JSON.stringify({ completionId: input.completionId })}::jsonb, 'pending'
    )
  `;
  if (claimId) {
    await sql`
      UPDATE campaign_claims
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = ${claimId}
    `;
  }
  await sql`UPDATE campaigns SET completed_slots = completed_slots + 1, updated_at = NOW() WHERE id = ${campaignId}`;
  return { campaignSubmissionId, campaignId };
}

export async function reviewCampaignSubmission(input: {
  taskId?: number;
  completionId?: number;
  campaignSubmissionId?: number;
  action: "approve" | "reject" | "needs_correction" | "dispute";
  reviewNote?: string;
}) {
  await ensureUniversalCampaignTables();
  let submissionRows: Record<string, unknown>[] = [];
  if (input.campaignSubmissionId) {
    submissionRows = await sql`SELECT * FROM campaign_submissions WHERE id = ${input.campaignSubmissionId}`;
  } else if (input.completionId) {
    submissionRows = await sql`
      SELECT cs.*
      FROM campaign_submissions cs
      JOIN campaign_proofs cp ON cp.submission_id = cs.id
      WHERE cp.metadata->>'completionId' = ${String(input.completionId)}
      LIMIT 1
    `;
  } else if (input.taskId) {
    submissionRows = await sql`SELECT * FROM campaign_submissions WHERE campaign_id IN (SELECT id FROM campaigns WHERE task_id = ${input.taskId}) LIMIT 1`;
  }
  if (!submissionRows?.length) return { ok: false, error: "Campaign submission not found", status: 404 };

  const submission = submissionRows[0];
  const status = input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : input.action === "needs_correction" ? "needs_correction" : "disputed";
  await sql`
    UPDATE campaign_submissions
    SET status = ${status},
        reviewed_at = NOW(),
        approved_at = CASE WHEN ${status} = 'approved' THEN NOW() ELSE approved_at END,
        rejected_at = CASE WHEN ${status} = 'rejected' THEN NOW() ELSE rejected_at END,
        review_note = ${input.reviewNote || ""},
        updated_at = NOW()
    WHERE id = ${submission.id}
  `;

  if (status === "approved") {
    await sql`
      UPDATE campaigns
      SET approved_slots = approved_slots + 1,
          spent_budget = spent_budget + ${Number(submission.reward_amount)},
          reserved_budget = GREATEST(0, reserved_budget - ${Number(submission.reward_amount)}),
          updated_at = NOW()
      WHERE id = ${submission.campaign_id}
    `;
    await sql`
      UPDATE campaign_wallets
      SET released_rewards = released_rewards + ${Number(submission.reward_amount)},
          reserved_rewards = GREATEST(0, reserved_rewards - ${Number(submission.reward_amount)}),
          updated_at = NOW()
      WHERE campaign_id = ${submission.campaign_id}
    `;
    await sql`
      INSERT INTO campaign_transactions (campaign_id, user_id, transaction_type, amount, status, reference, metadata)
      VALUES (${submission.campaign_id}, ${submission.contributor_id}, 'release_reward', ${Number(submission.reward_amount)}, 'completed', ${"QXR-" + submission.id}, ${JSON.stringify({ submissionId: submission.id })}::jsonb)
      ON CONFLICT (reference) DO NOTHING
    `;
  } else if (status === "rejected") {
    await sql`
      UPDATE campaigns
      SET rejected_slots = rejected_slots + 1, updated_at = NOW()
      WHERE id = ${submission.campaign_id}
    `;
  }

  return { ok: true, campaignSubmissionId: Number(submission.id), status };
}

export async function openCampaignDispute(input: {
  campaignSubmissionId: number;
  openedByUserId: number;
  reason: string;
}) {
  await ensureUniversalCampaignTables();
  const rows = await sql`SELECT id, campaign_id FROM campaign_submissions WHERE id = ${input.campaignSubmissionId}`;
  if (rows.length === 0) return { ok: false, error: "Submission not found", status: 404 };
  const submission = rows[0];
  const disputeRows = await sql`
    INSERT INTO campaign_disputes (campaign_id, submission_id, opened_by_user_id, reason, status)
    VALUES (${submission.campaign_id}, ${submission.id}, ${input.openedByUserId}, ${input.reason}, 'open')
    RETURNING id
  `;
  await sql`UPDATE campaign_submissions SET status = 'disputed', updated_at = NOW() WHERE id = ${submission.id}`;
  await createCampaignNotification({
    campaignId: Number(submission.campaign_id),
    recipientType: "admin",
    eventType: "dispute_opened",
    title: "Campaign dispute opened",
    message: input.reason,
    metadata: { submissionId: submission.id, openedByUserId: input.openedByUserId },
  });
  return { ok: true, disputeId: Number(disputeRows[0].id) };
}

export async function resolveCampaignDispute(input: {
  disputeId: number;
  resolution: "approve" | "reject" | "partial_reward" | "needs_correction";
  note?: string;
}) {
  await ensureUniversalCampaignTables();
  const rows = await sql`SELECT * FROM campaign_disputes WHERE id = ${input.disputeId}`;
  if (rows.length === 0) return { ok: false, error: "Dispute not found", status: 404 };
  const dispute = rows[0];
  await sql`
    UPDATE campaign_disputes
    SET status = 'resolved', resolution = ${input.resolution}, updated_at = NOW()
    WHERE id = ${input.disputeId}
  `;
  if (dispute.submission_id) {
    const action = input.resolution === "approve" || input.resolution === "partial_reward" ? "approve" : input.resolution === "reject" ? "reject" : "needs_correction";
    await reviewCampaignSubmission({ campaignSubmissionId: Number(dispute.submission_id), action, reviewNote: input.note });
  }
  return { ok: true, disputeId: input.disputeId, resolution: input.resolution };
}

export async function createCampaignNotification(input: {
  campaignId?: number;
  recipientType: "business" | "contributor" | "admin";
  recipientId?: number;
  eventType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await ensureUniversalCampaignTables();
  await sql`
    INSERT INTO campaign_notifications (
      campaign_id, recipient_type, recipient_id, event_type, title, message, metadata
    ) VALUES (
      ${input.campaignId || null}, ${input.recipientType}, ${input.recipientId || null},
      ${input.eventType}, ${input.title}, ${input.message},
      ${JSON.stringify(input.metadata || {})}::jsonb
    )
  `;
}

export async function transitionCampaignStatus(input: { campaignId: number; nextStatus: CampaignStatus; reason?: string }) {
  await ensureUniversalCampaignTables();
  const rows = await sql`SELECT id, task_id, status FROM campaigns WHERE id = ${input.campaignId}`;
  if (rows.length === 0) return { ok: false, error: "Campaign not found", status: 404 };
  const current = rows[0].status as CampaignStatus;
  if (!canTransitionCampaignStatus(current, input.nextStatus)) {
    return { ok: false, error: `Cannot move campaign from ${current} to ${input.nextStatus}`, status: 409 };
  }

  const isLive = input.nextStatus === "live";
  await sql`UPDATE campaigns SET status = ${input.nextStatus}, updated_at = NOW() WHERE id = ${input.campaignId}`;
  await sql`
    UPDATE tasks
    SET campaign_status = ${input.nextStatus},
        task_status = ${isLive ? "active" : input.nextStatus},
        is_active = ${isLive}
    WHERE id = ${rows[0].task_id}
  `;
  if (isLive && current !== "paused") {
    await activateMissionExpiryByTask(Number(rows[0].task_id));
  }
  return { ok: true, status: input.nextStatus };
}

export async function refundUnusedCampaignBudget(input: { campaignId: number; businessId?: number; reason?: string }) {
  await ensureUniversalCampaignTables();
  const rows = await sql`
    SELECT c.id, c.business_id, c.total_budget, c.spent_budget, c.platform_commission, c.verification_fee,
           cw.refunded_amount
    FROM campaigns c
    LEFT JOIN campaign_wallets cw ON cw.campaign_id = c.id
    WHERE c.id = ${input.campaignId}
  `;
  if (rows.length === 0) return { ok: false, error: "Campaign not found", status: 404 };
  const campaign = rows[0];
  if (input.businessId && Number(campaign.business_id) !== input.businessId) return { ok: false, error: "Forbidden", status: 403 };
  const refundable = Math.max(0, Number(campaign.total_budget) - Number(campaign.spent_budget) - Number(campaign.platform_commission) - Number(campaign.verification_fee) - Number(campaign.refunded_amount ?? 0));
  if (refundable <= 0) return { ok: true, refunded: 0 };

  await sql`UPDATE businesses SET balance = balance + ${refundable} WHERE id = ${campaign.business_id}`;
  await sql`
    UPDATE campaign_wallets
    SET refunded_amount = refunded_amount + ${refundable},
        available_balance = GREATEST(0, available_balance - ${refundable}),
        updated_at = NOW()
    WHERE campaign_id = ${input.campaignId}
  `;
  await sql`
    INSERT INTO campaign_transactions (campaign_id, user_id, transaction_type, amount, status, reference, metadata)
    VALUES (${input.campaignId}, ${campaign.business_id}, 'refund_unused', ${refundable}, 'completed', ${"QXF-" + input.campaignId + "-" + Date.now()}, ${JSON.stringify({ reason: input.reason || "unused_campaign_budget" })}::jsonb)
  `;
  return { ok: true, refunded: refundable };
}

export async function getCampaignAnalytics(campaignId: number): Promise<CampaignAnalytics | null> {
  await ensureUniversalCampaignTables();
  const rows = await sql`
    SELECT
      c.total_slots,
      c.filled_slots,
      c.approved_slots,
      c.rejected_slots,
      c.spent_budget,
      c.total_budget,
      COUNT(cs.id)::int AS submitted_count,
      COUNT(CASE WHEN cs.status = 'disputed' THEN 1 END)::int AS disputed_count
    FROM campaigns c
    LEFT JOIN campaign_submissions cs ON cs.campaign_id = c.id
    WHERE c.id = ${campaignId}
    GROUP BY c.id
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  const totalSlots = Number(row.total_slots);
  const submittedCount = Number(row.submitted_count);
  const approvedCount = Number(row.approved_slots);
  const rejectedCount = Number(row.rejected_slots);
  const completionRate = totalSlots > 0 ? Math.round((submittedCount / totalSlots) * 100) : 0;
  const approvalRate = submittedCount > 0 ? Math.round((approvedCount / submittedCount) * 100) : 0;
  const healthScore = Math.max(0, Math.min(100, Math.round((completionRate * 0.35) + (approvalRate * 0.45) + (100 - Math.min(100, rejectedCount * 10)) * 0.2)));

  return {
    totalSlots,
    claimedSlots: Number(row.filled_slots),
    submittedCount,
    approvedCount,
    rejectedCount,
    disputedCount: Number(row.disputed_count),
    completionRate,
    approvalRate,
    rewardSpend: Number(row.spent_budget),
    remainingBudget: Math.max(0, Number(row.total_budget) - Number(row.spent_budget)),
    healthScore,
  };
}
