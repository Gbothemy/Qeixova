import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = 20;
  const offset = (page - 1) * limit;
  const q = `%${search}%`;

  const [businesses, countRows, statsRows, locationRows] = await Promise.all([
    search
      ? sql`
          SELECT
            b.id,
            b.name,
            b.email,
            b.industry,
            b.website,
            COALESCE(NULLIF(b.profile #>> '{location,country}', ''), 'Not specified') AS country,
            NULLIF(b.profile #>> '{location,state}', '') AS state,
            NULLIF(b.profile #>> '{location,city}', '') AS city,
            b.balance,
            COALESCE(b.status, 'active') AS status,
            COALESCE(b.email_verified, TRUE) AS email_verified,
            COALESCE(b.onboarding_completed, FALSE) AS onboarding_completed,
            b.created_at,
            COUNT(t.id)::int AS campaign_count,
            COUNT(CASE WHEN COALESCE(t.campaign_status, t.task_status, '') = 'pending_review' THEN 1 END)::int AS pending_campaigns,
            COUNT(CASE WHEN COALESCE(t.campaign_status, t.task_status, '') IN ('live', 'approved') THEN 1 END)::int AS live_campaigns,
            COALESCE(SUM(t.total_budget), 0)::bigint AS reserved_budget
          FROM businesses b
          LEFT JOIN tasks t ON t.business_id = b.id AND COALESCE(t.task_status, '') <> 'deleted'
          WHERE b.name ILIKE ${q}
            OR b.email ILIKE ${q}
            OR COALESCE(b.industry, '') ILIKE ${q}
            OR COALESCE(b.website, '') ILIKE ${q}
            OR COALESCE(b.profile #>> '{location,country}', '') ILIKE ${q}
            OR COALESCE(b.profile #>> '{location,state}', '') ILIKE ${q}
            OR COALESCE(b.profile #>> '{location,city}', '') ILIKE ${q}
          GROUP BY b.id
          ORDER BY b.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `
      : sql`
          SELECT
            b.id,
            b.name,
            b.email,
            b.industry,
            b.website,
            COALESCE(NULLIF(b.profile #>> '{location,country}', ''), 'Not specified') AS country,
            NULLIF(b.profile #>> '{location,state}', '') AS state,
            NULLIF(b.profile #>> '{location,city}', '') AS city,
            b.balance,
            COALESCE(b.status, 'active') AS status,
            COALESCE(b.email_verified, TRUE) AS email_verified,
            COALESCE(b.onboarding_completed, FALSE) AS onboarding_completed,
            b.created_at,
            COUNT(t.id)::int AS campaign_count,
            COUNT(CASE WHEN COALESCE(t.campaign_status, t.task_status, '') = 'pending_review' THEN 1 END)::int AS pending_campaigns,
            COUNT(CASE WHEN COALESCE(t.campaign_status, t.task_status, '') IN ('live', 'approved') THEN 1 END)::int AS live_campaigns,
            COALESCE(SUM(t.total_budget), 0)::bigint AS reserved_budget
          FROM businesses b
          LEFT JOIN tasks t ON t.business_id = b.id AND COALESCE(t.task_status, '') <> 'deleted'
          GROUP BY b.id
          ORDER BY b.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
    search
      ? sql`
          SELECT COUNT(*)::int AS total
          FROM businesses
          WHERE name ILIKE ${q}
            OR email ILIKE ${q}
            OR COALESCE(industry, '') ILIKE ${q}
            OR COALESCE(website, '') ILIKE ${q}
            OR COALESCE(profile #>> '{location,country}', '') ILIKE ${q}
            OR COALESCE(profile #>> '{location,state}', '') ILIKE ${q}
            OR COALESCE(profile #>> '{location,city}', '') ILIKE ${q}
        `
      : sql`SELECT COUNT(*)::int AS total FROM businesses`,
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN COALESCE(status, 'active') = 'active' THEN 1 END)::int AS active,
        COUNT(CASE WHEN COALESCE(status, 'active') <> 'active' THEN 1 END)::int AS suspended,
        COALESCE(SUM(balance), 0)::bigint AS total_balance
      FROM businesses
    `,
    sql`
      SELECT
        COALESCE(NULLIF(profile #>> '{location,country}', ''), 'Not specified') AS country,
        COALESCE(NULLIF(profile #>> '{location,state}', ''), 'Not specified') AS region,
        COUNT(*)::int AS count
      FROM businesses
      GROUP BY country, region
      ORDER BY count DESC, country, region
    `,
  ]);

  return NextResponse.json({
    businesses,
    total: countRows[0]?.total ?? 0,
    stats: statsRows[0] ?? { total: 0, active: 0, suspended: 0, total_balance: 0 },
    locationGroups: locationRows,
  });
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id and action required" }, { status: 400 });

  if (action === "suspend") {
    await sql`UPDATE businesses SET status = 'suspended' WHERE id = ${id}`;
  } else if (action === "activate") {
    await sql`UPDATE businesses SET status = 'active' WHERE id = ${id}`;
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
