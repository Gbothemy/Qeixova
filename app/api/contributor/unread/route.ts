import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureMessagingSchema } from "@/lib/contributorFeatures";
import { ensureContributorNotificationsTable } from "@/lib/contributorNotifications";
import { sql } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await Promise.all([ensureMessagingSchema(), ensureContributorNotificationsTable()]);
    const [messageRows, notificationRows] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS unread
        FROM contributor_messages m
        JOIN contributor_conversations c ON c.id = m.conversation_id
        WHERE ${session.userId} IN (c.participant_low, c.participant_high)
          AND c.request_status <> 'declined'
          AND m.sender_id <> ${session.userId}
          AND m.read_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM contributor_user_blocks b
            WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high)
               OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low)
          )
      `,
      sql`SELECT COUNT(*)::int AS unread FROM contributor_notifications WHERE user_id = ${session.userId} AND read_at IS NULL`,
    ]);

    return NextResponse.json({
      unreadMessages: Number(messageRows[0]?.unread ?? 0),
      unreadNotifications: Number(notificationRows[0]?.unread ?? 0),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Contributor unread counts load failed:", error);
    return NextResponse.json({ error: "Unread counts could not load right now." }, { status: 503 });
  }
}
