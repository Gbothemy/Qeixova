import { NextRequest, NextResponse } from "next/server";
import { getBusinessSession } from "@/lib/businessAuth";
import { sql } from "@/lib/db";
import { ensureBusinessNotificationTables } from "@/lib/businessNotifications";

export async function GET() {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBusinessNotificationTables();

  const notifications = await sql`
    SELECT
      id::text,
      type,
      title,
      body,
      CASE WHEN read_at IS NULL THEN status ELSE 'Read' END AS status,
      tone,
      href,
      metadata,
      read_at,
      created_at
    FROM business_notifications
    WHERE business_id = ${session.businessId}
    ORDER BY created_at DESC
    LIMIT 80
  `;

  const statsRows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread
    FROM business_notifications
    WHERE business_id = ${session.businessId}
  `;

  const stats = [
    { label: "Unread", value: Number(statsRows[0]?.unread ?? 0), tone: "gold" },
  ].filter((item) => item.value > 0);

  return NextResponse.json({
    unread: Number(statsRows[0]?.unread ?? 0),
    stats,
    notifications,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getBusinessSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureBusinessNotificationTables();
  const body = await req.json().catch(() => ({}));
  const notificationId = Number(body?.notificationId);

  if (Number.isFinite(notificationId) && notificationId > 0) {
    await sql`
      UPDATE business_notifications
      SET read_at = COALESCE(read_at, NOW()), status = 'Read'
      WHERE business_id = ${session.businessId}
        AND id = ${notificationId}
    `;
  } else {
    await sql`
      UPDATE business_notifications
      SET read_at = COALESCE(read_at, NOW()), status = 'Read'
      WHERE business_id = ${session.businessId}
    `;
  }

  const unreadRows = await sql`
    SELECT COUNT(*)::int AS unread
    FROM business_notifications
    WHERE business_id = ${session.businessId}
      AND read_at IS NULL
  `;

  return NextResponse.json({ ok: true, unread: Number(unreadRows[0]?.unread ?? 0) });
}
