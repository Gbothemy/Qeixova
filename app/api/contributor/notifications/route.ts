import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sql } from "@/lib/db";
import {
  ensureContributorNotificationsTable,
  seedContributorTaskNotifications,
} from "@/lib/contributorNotifications";

function normalizeFilter(value: string | null) {
  return value === "read" || value === "unread" ? value : "all";
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureContributorNotificationsTable();
  await seedContributorTaskNotifications(session.userId).catch(() => {});

  const { searchParams } = new URL(req.url);
  const filter = normalizeFilter(searchParams.get("filter"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 12)));

  const notifications = await sql`
    SELECT id, type, title, message, href, metadata, read_at, created_at,
      CASE WHEN read_at IS NULL THEN 'unread' ELSE 'read' END AS status
    FROM contributor_notifications
    WHERE user_id = ${session.userId}
      AND (${filter} = 'all'
        OR (${filter} = 'unread' AND read_at IS NULL)
        OR (${filter} = 'read' AND read_at IS NOT NULL)
      )
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  const unreadRows = await sql`
    SELECT COUNT(*)::int AS unread
    FROM contributor_notifications
    WHERE user_id = ${session.userId}
      AND read_at IS NULL
  `;

  return NextResponse.json({
    notifications,
    unread: Number(unreadRows[0]?.unread ?? 0),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureContributorNotificationsTable();
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const markAll = body.markAll === true;

  if (markAll) {
    await sql`
      UPDATE contributor_notifications
      SET read_at = COALESCE(read_at, NOW())
      WHERE user_id = ${session.userId}
    `;
    return NextResponse.json({ ok: true });
  }

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Notification id required" }, { status: 400 });
  }

  const rows = await sql`
    UPDATE contributor_notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE user_id = ${session.userId}
      AND id = ${id}
    RETURNING id
  `;

  if (rows.length === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
