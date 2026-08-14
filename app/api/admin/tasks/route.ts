/**
 * Admin task management — protected by ADMIN_SECRET env var
 * 
 * GET  /api/admin/tasks          — list all tasks
 * POST /api/admin/tasks          — add a new task
 * PATCH /api/admin/tasks         — update a task (pass id + fields)
 * DELETE /api/admin/tasks        — deactivate a task (pass id)
 */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendCampaignLiveEmail } from "@/lib/email";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createBusinessNotification } from "@/lib/businessNotifications";
import { canonicalizeInterests } from "@/lib/interestTaxonomy";
import { activateMissionExpiryByTask, expireElapsedMissions } from "@/lib/missionExpiry";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await expireElapsedMissions();
  const tasks = await sql`
    SELECT
      t.*,
      COALESCE(t.mission_type, 'engagement') AS mission_type,
      COALESCE(t.xp_reward, 0) AS xp_reward,
      COALESCE(t.min_level, 1) AS min_level,
      COALESCE(t.task_status, 'active') AS task_status,
      COALESCE(t.campaign_status, t.task_status, 'active') AS campaign_status,
      COALESCE(t.campaign_metadata, '{}'::jsonb) AS campaign_metadata,
      COALESCE(t.campaign_pricing, '{}'::jsonb) AS campaign_pricing,
      COALESCE(t.target_completion_count, 0) AS target_completion_count,
      COALESCE(t.target_interests, '{}') AS target_interests,
      COALESCE(t.target_platforms, '{}') AS target_platforms,
      COALESCE(t.target_states, '{}') AS target_states,
      COALESCE(t.target_professions, '{}') AS target_professions,
      COALESCE(b.name, '') AS business_name,
      COUNT(c.id)::int AS submissions_count,
      COUNT(CASE WHEN c.status = 'pending' THEN 1 END)::int AS pending_count,
      COUNT(CASE WHEN c.status = 'approved' THEN 1 END)::int AS approved_count,
      COUNT(CASE WHEN c.status = 'rejected' THEN 1 END)::int AS rejected_count
    FROM tasks t
    LEFT JOIN businesses b ON b.id = t.business_id
    LEFT JOIN completions c ON c.task_id = t.id
    GROUP BY t.id, b.name
    ORDER BY t.created_at DESC, t.category, t.reward DESC
  `;
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { title, category, reward, duration, icon, color, instructions, steps, proof_type, proof_label, max_screenshots } = body;

  if (!title || !category || !reward) {
    return NextResponse.json({ error: "title, category and reward are required" }, { status: 400 });
  }

  const result = await sql`
    INSERT INTO tasks (
      title, category, reward, duration, icon, color, instructions, steps,
      proof_type, proof_label, max_screenshots, total_budget, task_link,
      mission_type, xp_reward, min_level, target_interests, target_platforms,
      target_states, is_active, task_status, campaign_status
    )
    VALUES (
      ${title}, ${category}, ${reward},
      ${duration ?? "5 min"}, ${icon ?? "📋"}, ${color ?? "#e8f5e9"},
      ${instructions ?? ""}, ${steps ?? []}, ${proof_type ?? "screenshot"},
      ${proof_label ?? "Upload screenshot as proof"}, ${max_screenshots ?? 1},
      ${body.total_budget ?? 0}, ${body.task_link ?? ""},
      ${body.mission_type ?? "engagement"}, ${body.xp_reward ?? 0}, ${body.min_level ?? 1},
      ${canonicalizeInterests(body.target_interests)},
      ${Array.isArray(body.target_platforms) ? body.target_platforms : []},
      ${Array.isArray(body.target_states) ? body.target_states : []},
      true, 'active', 'active'
    )
    RETURNING id, title, category, reward, mission_type
  `;

  return NextResponse.json({ ok: true, task: result[0] });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, ...fields } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Build dynamic update — only update provided fields
  const allowed = ["title", "category", "reward", "duration", "icon", "color", "instructions", "steps", "proof_type", "proof_label", "max_screenshots", "is_active", "total_budget", "task_link", "mission_type", "xp_reward", "min_level", "target_interests", "target_platforms", "target_states", "task_status", "campaign_status"];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      if (key === "title")          await sql`UPDATE tasks SET title = ${fields[key]} WHERE id = ${id}`;
      else if (key === "category")  await sql`UPDATE tasks SET category = ${fields[key]} WHERE id = ${id}`;
      else if (key === "reward")    await sql`UPDATE tasks SET reward = ${fields[key]} WHERE id = ${id}`;
      else if (key === "duration")  await sql`UPDATE tasks SET duration = ${fields[key]} WHERE id = ${id}`;
      else if (key === "icon")      await sql`UPDATE tasks SET icon = ${fields[key]} WHERE id = ${id}`;
      else if (key === "color")     await sql`UPDATE tasks SET color = ${fields[key]} WHERE id = ${id}`;
      else if (key === "instructions") await sql`UPDATE tasks SET instructions = ${fields[key]} WHERE id = ${id}`;
      else if (key === "steps")     await sql`UPDATE tasks SET steps = ${fields[key]} WHERE id = ${id}`;
      else if (key === "proof_type") await sql`UPDATE tasks SET proof_type = ${fields[key]} WHERE id = ${id}`;
      else if (key === "proof_label") await sql`UPDATE tasks SET proof_label = ${fields[key]} WHERE id = ${id}`;
      else if (key === "max_screenshots") await sql`UPDATE tasks SET max_screenshots = ${fields[key]} WHERE id = ${id}`;
      else if (key === "total_budget")   await sql`UPDATE tasks SET total_budget = ${fields[key]} WHERE id = ${id}`;
      else if (key === "task_link")      await sql`UPDATE tasks SET task_link = ${fields[key]} WHERE id = ${id}`;
      else if (key === "target_interests") await sql`UPDATE tasks SET target_interests = ${canonicalizeInterests(fields[key])} WHERE id = ${id}`;
      else if (key === "target_platforms") await sql`UPDATE tasks SET target_platforms = ${Array.isArray(fields[key]) ? fields[key] : []} WHERE id = ${id}`;
      else if (key === "target_states") await sql`UPDATE tasks SET target_states = ${Array.isArray(fields[key]) ? fields[key] : []} WHERE id = ${id}`;
      else if (key === "task_status") await sql`UPDATE tasks SET task_status = ${fields[key]} WHERE id = ${id}`;
      else if (key === "campaign_status") await sql`UPDATE tasks SET campaign_status = ${fields[key]} WHERE id = ${id}`;
      else if (key === "is_active") {
        await sql`
          UPDATE tasks
          SET is_active = ${fields[key]},
              task_status = CASE
                WHEN business_id IS NOT NULL AND ${fields[key]} = true THEN 'active'
                WHEN business_id IS NOT NULL AND ${fields[key]} = false THEN 'paused'
                ELSE COALESCE(task_status, 'active')
              END,
              campaign_status = CASE
                WHEN business_id IS NOT NULL AND ${fields[key]} = true THEN 'live'
                WHEN business_id IS NOT NULL AND ${fields[key]} = false THEN 'paused'
                ELSE COALESCE(campaign_status, task_status, 'active')
              END
          WHERE id = ${id}
        `;
        await sql`
          UPDATE campaigns
          SET status = ${fields[key] === true ? "live" : "paused"},
              updated_at = NOW()
          WHERE task_id = ${id}
            AND COALESCE(status, '') NOT IN ('closed', 'rejected')
        `;
        // If activating a business task, notify the business
        if (fields[key] === true) {
          await activateMissionExpiryByTask(Number(id));
          const taskInfo = await sql`
            SELECT t.title, t.business_id, b.email, b.name FROM tasks t
            LEFT JOIN businesses b ON b.id = t.business_id
            WHERE t.id = ${id}
          `;
          if (taskInfo.length > 0 && taskInfo[0].email) {
            sendCampaignLiveEmail(taskInfo[0].email, taskInfo[0].name, taskInfo[0].title).catch(() => {});
          }
          if (taskInfo[0]?.business_id) {
            await createBusinessNotification({
              businessId: Number(taskInfo[0].business_id),
              type: "approved",
              tone: "green",
              title: "Campaign activated",
              body: `${taskInfo[0].title} is now active and visible to contributors.`,
              status: "Active",
              href: `/business/tasks/${id}`,
              metadata: { taskId: id },
            });
          }
        }
      }
      else if (key === "mission_type")   await sql`UPDATE tasks SET mission_type = ${fields[key]} WHERE id = ${id}`;
      else if (key === "xp_reward")      await sql`UPDATE tasks SET xp_reward = ${fields[key]} WHERE id = ${id}`;
      else if (key === "min_level")      await sql`UPDATE tasks SET min_level = ${fields[key]} WHERE id = ${id}`;
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Soft delete — deactivate rather than destroy
  await sql`UPDATE tasks SET is_active = FALSE WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
