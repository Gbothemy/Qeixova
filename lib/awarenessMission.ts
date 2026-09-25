import { sql } from "@/lib/db";
import { ensureUniversalCampaignTaskColumns } from "@/lib/universalCampaignEngine";
import { ensureCompletionAttemptSchema } from "@/lib/antiFraud";

export const AWARENESS_MISSION_KEY = "qeixova-awareness-verification";
export const AWARENESS_MISSION_REWARD_QLT = 1_000;
export const AWARENESS_MISSION_MAX_REWARD_QLT = 10_000;

const AWARENESS_PLATFORMS = [
  "WhatsApp Status",
  "Facebook",
  "Instagram",
  "TikTok",
  "X",
  "LinkedIn",
  "Telegram",
  "Snapchat",
] as const;

const AWARENESS_PLATFORM_REWARDS: Record<(typeof AWARENESS_PLATFORMS)[number], number> = {
  "WhatsApp Status": 1_500,
  Facebook: 1_500,
  Instagram: 1_500,
  TikTok: 1_000,
  X: 1_500,
  LinkedIn: 1_000,
  Telegram: 1_000,
  Snapchat: 1_000,
};

const AWARENESS_CAPTIONS = [
  {
    platform: "WhatsApp Status",
    caption: "I just joined Qeixova, where people can promote, test, share feedback, and support growing ideas through real missions. Join me: https://qeixova.com/register #Qeixova #Growth",
  },
  {
    platform: "Facebook",
    caption: "Discover Qeixova: a place to support growing businesses and ideas by promoting, testing, sharing feedback, and completing real missions. Join the community: https://qeixova.com/register #Qeixova #GrowthPartners",
  },
  {
    platform: "Instagram",
    caption: "Good ideas grow when we support them 🌱 I joined Qeixova to promote, test, share feedback, and help growing ideas reach more people. Join in: https://qeixova.com/register #Qeixova #Growth #Community",
  },
  {
    platform: "TikTok",
    caption: "Found a new way to support growing ideas: Qeixova missions let you promote, test, share feedback, and help real projects grow. Join me at qeixova.com/register #Qeixova #Growth",
  },
  {
    platform: "X",
    caption: "I joined @qeixovatech to help growing ideas through promotion, testing, feedback, and sharing. Discover Qeixova: https://qeixova.com/register #Qeixova #GrowthPartners",
  },
  {
    platform: "LinkedIn",
    caption: "I’ve joined Qeixova, a platform connecting people with missions to promote, test, and provide feedback on growing ideas. Learn more and join: https://qeixova.com/register #Qeixova #Growth",
  },
  {
    platform: "Telegram",
    caption: "I joined Qeixova to support growing businesses and ideas with real missions—promote, test, share feedback, and help good work reach more people. Join here: https://qeixova.com/register #Qeixova",
  },
  {
    platform: "Snapchat",
    caption: "I’m on Qeixova! Join me in helping growing ideas through promotion, testing, and feedback. Sign up: qeixova.com/register #Qeixova #Growth",
  },
] as const;

/** A permanent, platform-owned mission that every growth partner completes first. */
export async function ensureAwarenessMission() {
  // Registration is often the first path through the application. Ensure the
  // fields used by this platform-owned mission exist before inserting it.
  await ensureUniversalCampaignTaskColumns();
  await ensureCompletionAttemptSchema();
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mission_key TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS tasks_mission_key_unique_idx ON tasks (mission_key) WHERE mission_key IS NOT NULL`;
  const rows = await sql`
    INSERT INTO tasks (
      mission_key, title, category, reward, duration, icon, color,
      instructions, steps, proof_type, proof_label, max_screenshots,
      target_platforms, campaign_metadata,
      is_active, task_status, campaign_status, mission_type, min_level
    ) VALUES (
      ${AWARENESS_MISSION_KEY}, 'Welcome to Qeixova: Share & Unlock', 'Getting Started',
      ${AWARENESS_MISSION_MAX_REWARD_QLT}, '15 min', '🌱', '#e8f5e9',
      'Share the Qeixova image on one or more of the listed social platforms using each platform caption. Choose only platforms where you have published the post and upload a screenshot for each. WhatsApp Status, Facebook, Instagram, and X pay 1,500 QLT each; TikTok, Telegram, LinkedIn, and Snapchat pay 1,000 QLT each. Rewards add up across the platforms you select. Once approved, your regular missions unlock.',
      ARRAY[
        'Download the Qeixova image and publish it as a public post or status on one or more of these platforms: WhatsApp Status, Facebook, Instagram, TikTok, X, LinkedIn, Telegram, and Snapchat.',
        'Select the platforms where you posted and use the matching caption provided. Keep each post visible until your submission is reviewed.',
        'Upload one clear screenshot for each selected platform. Screenshots must show the published Qeixova image and enough of the account or platform screen to identify the post.'
      ],
      'screenshot', 'Choose the platforms where you posted and upload one screenshot for each selected platform.', 8,
      ${AWARENESS_PLATFORMS}::text[],
      ${JSON.stringify({
        contentType: "Qeixova awareness image",
        assetName: "qeixova-growth-partner-awareness.jpeg",
        assetDataUrl: "/qeixova-growth-partner-awareness.jpeg",
        assetMimeType: "image/jpeg",
        fixedRewardRegardlessOfPlatforms: false,
        selectedPricingLabel: "Choose one or more platforms",
        selectedPricingPlatforms: AWARENESS_PLATFORMS,
        selectedPricingOptions: AWARENESS_PLATFORMS.map((platform, index) => ({
          id: `awareness-${index}`,
          label: platform,
          platform,
          rewardQlt: AWARENESS_PLATFORM_REWARDS[platform],
        })),
        captionOptions: AWARENESS_CAPTIONS,
        objective: "Share the official Qeixova image on any platforms you use. WhatsApp Status, Facebook, Instagram, and X pay 1,500 QLT each; TikTok, Telegram, LinkedIn, and Snapchat pay 1,000 QLT each. Select one or more platforms, submit one screenshot per platform, and earn the selected rewards if approved.",
        audience: ["All growth partners"],
      })}::jsonb,
      TRUE, 'active', 'live', 'engagement', 1
    )
    ON CONFLICT (mission_key) WHERE mission_key IS NOT NULL DO UPDATE SET
      title = EXCLUDED.title,
      reward = EXCLUDED.reward,
      duration = EXCLUDED.duration,
      icon = EXCLUDED.icon,
      color = EXCLUDED.color,
      instructions = EXCLUDED.instructions,
      steps = EXCLUDED.steps,
      proof_type = EXCLUDED.proof_type,
      proof_label = EXCLUDED.proof_label,
      max_screenshots = EXCLUDED.max_screenshots,
      total_budget = 0,
      budget_used = 0,
      target_platforms = EXCLUDED.target_platforms,
      campaign_metadata = EXCLUDED.campaign_metadata,
      target_professions = ARRAY[]::text[],
      target_interests = ARRAY[]::text[],
      target_age_ranges = ARRAY[]::text[],
      target_genders = ARRAY[]::text[],
      target_countries = ARRAY[]::text[],
      target_states = ARRAY[]::text[],
      expires_at = NULL,
      is_active = TRUE, task_status = 'active', campaign_status = 'live'
    RETURNING id
  `;
  return Number(rows[0].id);
}

export async function hasApprovedAwarenessMission(userId: number) {
  const rows = await sql`
    SELECT 1 FROM completions c JOIN tasks t ON t.id = c.task_id
    WHERE c.user_id = ${userId} AND c.status = 'approved'
      AND t.mission_key = ${AWARENESS_MISSION_KEY}
    LIMIT 1
  `;
  return rows.length > 0;
}
