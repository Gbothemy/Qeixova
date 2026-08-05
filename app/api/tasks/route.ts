import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import { canonicalizeInterests, interestMatches } from "@/lib/interestTaxonomy";
import { ensureUniversalCampaignTables } from "@/lib/universalCampaignEngine";
import { displayLevel } from "@/lib/levels";
import { expireElapsedMissions } from "@/lib/missionExpiry";

type TargetLocationMetadata = {
  targetLocation?: {
    mode?: string;
    locations?: Array<{
      name?: string | null;
      region?: string | null;
      state?: string | null;
      country?: string | null;
    }>;
  };
};

function normalizeValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeState(value: unknown) {
  const normalized = normalizeValue(value)
    .replace(/\bfederal capital territory\b/g, "fct")
    .replace(/\bstate\b/g, "")
    .replace(/\bnigeria\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized === "abuja" || normalized === "fct" || normalized === "fct abuja") return "fct abuja";
  return normalized;
}

function normalizeList(values: unknown) {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
}

function deriveStateTargets(task: Record<string, unknown>) {
  const directTargets = normalizeList(task.target_states);
  const metadata = task.campaign_metadata as TargetLocationMetadata | null;
  const locationTargets = metadata?.targetLocation?.locations?.flatMap((location) => [
    location.state,
    location.region,
    location.name,
  ]) ?? [];

  return [...new Set([...directTargets, ...locationTargets].map(normalizeState).filter((value) => value && value !== "nigeria"))];
}

function singleValueMatches(targets: string[], userValue: unknown) {
  if (targets.length === 0) return true;
  const normalizedUserValue = normalizeValue(userValue);
  if (!normalizedUserValue) return false;
  return targets.map(normalizeValue).includes(normalizedUserValue);
}

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

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await ensureUniversalCampaignTables();
    await expireElapsedMissions();

    // Get user profile + level info for targeting and cap enforcement
    const userRows = await sql`
      SELECT u.profession, u.interests, u.platforms, u.age_range, u.gender, u.state,
             u.xp, u.trust_score, u.daily_earned, u.daily_reset_at,
             l.level_number, l.daily_cap_qlt, l.name AS level_name, l.badge_color,
             l.unlock_features
      FROM users u
      LEFT JOIN levels l ON l.id = u.level_id
      WHERE u.id = ${session.userId}
    `;
    const user = userRows[0] ?? {};

    // Reset daily cap if new day
    const today = new Date().toISOString().split("T")[0];
    if (user.daily_reset_at && new Date(user.daily_reset_at).toISOString().split("T")[0] < today) {
      await sql`UPDATE users SET daily_earned = 0, daily_reset_at = ${today} WHERE id = ${session.userId}`;
      user.daily_earned = 0;
    }

    const userLevelNum = displayLevel(user.level_number);
    const allowedMissionTypes = getAllowedMissionTypes(user.unlock_features);

    // Fetch active missions with completion status
    const tasks = await sql`
      SELECT
        t.id, t.title, t.category, t.reward, t.duration,
        t.icon, t.color,
        COALESCE(t.instructions, '') AS instructions,
        COALESCE(t.steps, '{}') AS steps,
        COALESCE(t.proof_type, 'screenshot') AS proof_type,
        COALESCE(t.proof_label, 'Upload screenshot as proof') AS proof_label,
        COALESCE(t.max_screenshots, 1) AS max_screenshots,
        COALESCE(t.total_budget, 0) AS total_budget,
        COALESCE(t.budget_used, 0) AS budget_used,
        COALESCE(t.task_link, '') AS task_link,
        COALESCE(t.mission_type, 'engagement') AS mission_type,
        COALESCE(t.xp_reward, 0) AS xp_reward,
        COALESCE(t.verification_type, t.proof_type, 'screenshot') AS verification_type,
        COALESCE(t.difficulty, 'easy') AS difficulty,
        COALESCE(t.min_level, 1) AS min_level,
        COALESCE(t.estimated_time, t.duration, '5 min') AS estimated_time,
        COALESCE(t.campaign_goal, '') AS campaign_goal,
        COALESCE(t.campaign_status, '') AS campaign_status,
        t.approved_at,
        t.expires_at,
        COALESCE(t.campaign_pricing, '{}'::jsonb) AS campaign_pricing,
        COALESCE(t.campaign_metadata, '{}'::jsonb) AS campaign_metadata,
        COALESCE(t.target_completion_count, 0) AS target_completion_count,
        COALESCE(b.name, '') AS business_name,
        COALESCE(t.target_professions, '{}') AS target_professions,
        COALESCE(t.target_interests, '{}') AS target_interests,
        COALESCE(t.target_platforms, '{}') AS target_platforms,
        COALESCE(t.target_age_ranges, '{}') AS target_age_ranges,
        COALESCE(t.target_genders, '{}') AS target_genders,
        COALESCE(t.target_states, '{}') AS target_states,
        cpg.id AS campaign_id,
        COALESCE(cpg.status, '') AS universal_campaign_status,
        CASE WHEN c.id IS NOT NULL THEN true ELSE false END AS completed,
        c.status AS completion_status
      FROM tasks t
      LEFT JOIN businesses b ON b.id = t.business_id
      LEFT JOIN campaigns cpg ON cpg.task_id = t.id
      LEFT JOIN completions c ON c.task_id = t.id AND c.user_id = ${session.userId}
      WHERE (
          (t.is_active = true AND COALESCE(t.task_status, 'active') = 'active')
          OR COALESCE(cpg.status, '') = 'live'
          OR COALESCE(t.campaign_status, '') = 'live'
        )
        AND COALESCE(t.task_status, '') NOT IN ('rejected', 'closed', 'deleted')
        AND COALESCE(t.campaign_status, '') NOT IN ('rejected', 'closed')
        AND COALESCE(cpg.status, '') NOT IN ('rejected', 'closed')
        AND (t.expires_at IS NULL OR t.expires_at > NOW())
        AND (cpg.end_date IS NULL OR cpg.end_date > NOW())
        AND (t.total_budget = 0 OR t.budget_used < t.total_budget)
      ORDER BY t.reward DESC
    `;

    const dailyEarned = Number(user.daily_earned ?? 0);
    const dailyCap = Number(user.daily_cap_qlt ?? 5000);
    const dailyRemaining = Math.max(0, dailyCap - dailyEarned);
    const userState = normalizeState(user.state);
    const normalizedInterests = canonicalizeInterests(user.interests);

    // Score + filter tasks
    const scored = tasks.map((task: Record<string, unknown>) => {
      // Level gate
      const minLevel = Number(task.min_level ?? 1);
      const lockedByLevel = userLevelNum < minLevel;

      // Mission type gate
      const mType = task.mission_type as string;
      const lockedByType = allowedMissionTypes.size > 0 ? !allowedMissionTypes.has(mType) : false;

      // Targeting score
      const stateTargets = deriveStateTargets(task);
      const targetInterests = canonicalizeInterests(task.target_interests);
      const hasUserState = Boolean(userState);
      const hasUserInterests = normalizedInterests.length > 0;
      const stateMatched = stateTargets.length === 0 || (hasUserState && stateTargets.includes(userState));
      const interestsMatched = targetInterests.length === 0 || (hasUserInterests && interestMatches(targetInterests, normalizedInterests));
      const stateScoreMatched = stateTargets.length === 0 || (hasUserState && stateTargets.includes(userState));
      const interestsScoreMatched = targetInterests.length === 0 || (hasUserInterests && interestMatches(targetInterests, normalizedInterests));
      const criteria = [
        { targets: normalizeList(task.target_professions), userVal: user.profession },
        { targets: normalizeList(task.target_age_ranges),  userVal: user.age_range },
        { targets: normalizeList(task.target_genders),     userVal: user.gender },
      ];
      const arrayMatches = [
        { targets: targetInterests, matched: interestsScoreMatched },
        { targets: stateTargets, matched: stateScoreMatched },
      ];

      let totalCriteria = 0;
      let matchedCriteria = 0;
      for (const { targets, userVal } of criteria) {
        if (targets.length > 0) {
          totalCriteria++;
          if (singleValueMatches(targets, userVal)) matchedCriteria++;
        }
      }
      for (const { targets, matched } of arrayMatches) {
        if (targets.length > 0) {
          totalCriteria++;
          if (matched) matchedCriteria++;
        }
      }

      const matchScore = totalCriteria === 0 ? 100 : Math.round((matchedCriteria / totalCriteria) * 100);
      const blockedByLocation = stateTargets.length > 0 && !stateMatched;
      const blockedByInterests = targetInterests.length > 0 && !interestsMatched;
      const blockedByKnownProfileMismatch = criteria.some(({ targets, userVal }) => targets.length > 0 && Boolean(userVal) && !singleValueMatches(targets, userVal));
      const hidden = blockedByLocation || blockedByInterests || blockedByKnownProfileMismatch;

      return { ...task, matchScore, hidden, lockedByLevel, lockedByType, minLevel };
    });

    const visible = scored
      .filter((t: Record<string, unknown>) => !t.hidden)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        // Completed last
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        // Locked last
        const aLocked = (a.lockedByLevel || a.lockedByType) ? 1 : 0;
        const bLocked = (b.lockedByLevel || b.lockedByType) ? 1 : 0;
        if (aLocked !== bLocked) return aLocked - bLocked;
        // Premium first, then participation, then engagement
        const typeOrder: Record<string, number> = { premium: 0, participation: 1, engagement: 2 };
        const aOrder = typeOrder[a.mission_type as string] ?? 2;
        const bOrder = typeOrder[b.mission_type as string] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Then by match score, then reward
        if ((b.matchScore as number) !== (a.matchScore as number)) return (b.matchScore as number) - (a.matchScore as number);
        return (b.reward as number) - (a.reward as number);
      });

    return NextResponse.json({
      tasks: visible,
      meta: {
        userLevel: userLevelNum,
        levelName: user.level_name ?? "Starter",
        badgeColor: user.badge_color ?? "#888888",
        xp: user.xp ?? 0,
        dailyEarned,
        dailyCap,
        dailyRemaining,
        trustScore: user.trust_score ?? 100,
        state: user.state ?? "",
        interests: normalizedInterests,
      },
    });
  } catch (err) {
    console.error("Tasks fetch error:", err);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
}
