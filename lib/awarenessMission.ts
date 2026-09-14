import { sql } from "@/lib/db";
import { ensureUniversalCampaignTaskColumns } from "@/lib/universalCampaignEngine";

export const AWARENESS_MISSION_KEY = "qeixova-awareness-verification";

/** A permanent, platform-owned mission that every contributor completes first. */
export async function ensureAwarenessMission() {
  // Registration is often the first path through the application. Ensure the
  // fields used by this platform-owned mission exist before inserting it.
  await ensureUniversalCampaignTaskColumns();
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mission_key TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS tasks_mission_key_unique_idx ON tasks (mission_key) WHERE mission_key IS NOT NULL`;
  const rows = await sql`
    INSERT INTO tasks (
      mission_key, title, category, reward, duration, icon, color,
      instructions, steps, proof_type, proof_label, max_screenshots,
      is_active, task_status, campaign_status, mission_type, min_level
    ) VALUES (
      ${AWARENESS_MISSION_KEY}, 'Qeixova Awareness & Verification', 'Getting Started',
      0, '3 min', '🛡️', '#e8f5e9',
      'Read the Qeixova community rules, mission-proof standards, and reward process. This one-time verification must be approved before you can access other missions.',
      ARRAY['Read the Qeixova mission and community guidelines', 'Understand that proof must be genuine and submitted only after you complete a mission', 'Type: I understand the Qeixova mission rules'],
      'text', 'Type: I understand the Qeixova mission rules', 1,
      TRUE, 'active', 'live', 'engagement', 1
    )
    ON CONFLICT (mission_key) WHERE mission_key IS NOT NULL DO UPDATE SET
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
