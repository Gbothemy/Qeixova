import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ensureCreatorSchema, ensureMessagingSchema } from "@/lib/contributorFeatures";
import { sql } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await Promise.all([ensureMessagingSchema(), ensureCreatorSchema()]);
    const conversationId = Number(request.nextUrl.searchParams.get("conversationId"));
    if (Number.isSafeInteger(conversationId) && conversationId > 0) {
      const access = await sql`
        SELECT c.id, c.request_status, c.initiated_by,
          CASE WHEN c.participant_low = ${session.userId} THEN high.id ELSE low.id END AS other_id,
          CASE WHEN c.participant_low = ${session.userId} THEN high.full_name ELSE low.full_name END AS other_name,
          EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low)) AS blocked
        FROM contributor_conversations c
        JOIN users low ON low.id = c.participant_low
        JOIN users high ON high.id = c.participant_high
        WHERE c.id = ${conversationId} AND ${session.userId} IN (c.participant_low, c.participant_high)
        LIMIT 1
      `;
      if (!access.length || access[0].blocked || access[0].request_status === "declined") return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const isRequestRecipient = Number(access[0].initiated_by) !== session.userId && access[0].request_status === "pending";
      if (!isRequestRecipient) await sql`UPDATE contributor_messages SET read_at = NOW() WHERE conversation_id = ${conversationId} AND sender_id <> ${session.userId} AND read_at IS NULL`;
      const messages = await sql`SELECT id, sender_id, body, created_at, read_at FROM contributor_messages WHERE conversation_id = ${conversationId} ORDER BY created_at DESC LIMIT 100`;
      return NextResponse.json({
        conversation: { ...access[0], blocked: undefined, id: Number(access[0].id), other_id: Number(access[0].other_id), initiated_by: Number(access[0].initiated_by) },
        messages: messages.reverse().map((message) => ({ ...message, id: Number(message.id), sender_id: Number(message.sender_id) })),
      });
    }

    const conversations = await sql`
      SELECT c.id, c.request_status, c.initiated_by,
        CASE WHEN c.participant_low = ${session.userId} THEN high.id ELSE low.id END AS other_id,
        CASE WHEN c.participant_low = ${session.userId} THEN high.full_name ELSE low.full_name END AS other_name,
        latest.body AS last_message, latest.created_at AS last_message_at,
        (SELECT COUNT(*)::int FROM contributor_messages unread WHERE unread.conversation_id = c.id AND unread.sender_id <> ${session.userId} AND unread.read_at IS NULL) AS unread_count
      FROM contributor_conversations c
      JOIN users low ON low.id = c.participant_low
      JOIN users high ON high.id = c.participant_high
      LEFT JOIN LATERAL (SELECT body, created_at FROM contributor_messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) latest ON true
      WHERE ${session.userId} IN (c.participant_low, c.participant_high)
        AND c.request_status <> 'declined'
        AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = c.participant_low AND b.blocked_id = c.participant_high) OR (b.blocker_id = c.participant_high AND b.blocked_id = c.participant_low))
      ORDER BY COALESCE(latest.created_at, c.created_at) DESC LIMIT 100
    `;
    const people = await sql`
      SELECT u.id, u.full_name FROM users u WHERE u.id <> ${session.userId} AND COALESCE(u.email_verified, false) = true
        AND EXISTS (SELECT 1 FROM creator_follows f WHERE f.follower_id = ${session.userId} AND f.creator_id = u.id)
        AND EXISTS (SELECT 1 FROM creator_follows f WHERE f.follower_id = u.id AND f.creator_id = ${session.userId})
        AND NOT EXISTS (SELECT 1 FROM contributor_user_blocks b WHERE (b.blocker_id = ${session.userId} AND b.blocked_id = u.id) OR (b.blocker_id = u.id AND b.blocked_id = ${session.userId}))
      ORDER BY u.full_name ASC LIMIT 200
    `;
    const mapped = conversations.map((conversation) => ({ ...conversation, id: Number(conversation.id), other_id: Number(conversation.other_id), initiated_by: Number(conversation.initiated_by), unread_count: Number(conversation.unread_count), request_status: String(conversation.request_status) }));
    return NextResponse.json({
      conversations: mapped.filter((conversation) => conversation.request_status === "accepted" || conversation.initiated_by === session.userId),
      requests: mapped.filter((conversation) => conversation.request_status === "pending" && conversation.initiated_by !== session.userId),
      people: people.map((person) => ({ ...person, id: Number(person.id) })),
    });
  } catch (error) {
    console.error("Contributor messages load failed:", error);
    return NextResponse.json({ error: "Messages could not load right now. Please try again." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json().catch(() => ({}));
  try {
    await Promise.all([ensureMessagingSchema(), ensureCreatorSchema()]);
    if (payload.action === "start") {
      const recipientId = Number(payload.recipientId);
      if (!Number.isSafeInteger(recipientId) || recipientId <= 0 || recipientId === session.userId) return NextResponse.json({ error: "Choose another contributor to start a chat." }, { status: 400 });
      const recipient = await sql`SELECT id FROM users WHERE id = ${recipientId} AND COALESCE(email_verified, false) = true LIMIT 1`;
      if (!recipient.length) return NextResponse.json({ error: "That contributor is not available." }, { status: 404 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${session.userId} AND blocked_id = ${recipientId}) OR (blocker_id = ${recipientId} AND blocked_id = ${session.userId}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This contributor is unavailable for messaging." }, { status: 403 });
      const mutualFollow = await sql`
        SELECT 1 FROM creator_follows outgoing WHERE outgoing.follower_id = ${session.userId} AND outgoing.creator_id = ${recipientId}
          AND EXISTS (SELECT 1 FROM creator_follows incoming WHERE incoming.follower_id = ${recipientId} AND incoming.creator_id = ${session.userId}) LIMIT 1
      `;
      const sourcePostId = Number(payload.sourcePostId);
      let validPostOrigin = false;
      if (Number.isSafeInteger(sourcePostId) && sourcePostId > 0) {
        const sourcePost = await sql`SELECT id FROM creator_posts WHERE id = ${sourcePostId} AND user_id = ${recipientId} LIMIT 1`;
        validPostOrigin = sourcePost.length > 0;
      }
      if (!mutualFollow.length && !validPostOrigin) return NextResponse.json({ error: "Follow each other to chat, or open a message request from one of their posts." }, { status: 403 });
      const low = Math.min(session.userId, recipientId);
      const high = Math.max(session.userId, recipientId);
      const rows = await sql`
        INSERT INTO contributor_conversations (participant_low, participant_high, initiated_by, source_post_id, request_status)
        VALUES (${low}, ${high}, ${session.userId}, ${validPostOrigin ? sourcePostId : null}, ${mutualFollow.length ? "accepted" : "pending"})
        ON CONFLICT (participant_low, participant_high) DO UPDATE SET
          request_status = CASE WHEN ${mutualFollow.length > 0} THEN 'accepted' ELSE contributor_conversations.request_status END
        RETURNING id, request_status, initiated_by
      `;
      if (rows[0].request_status === "declined") return NextResponse.json({ error: "This message request was declined." }, { status: 403 });
      return NextResponse.json({ ok: true, conversationId: Number(rows[0].id), requestStatus: rows[0].request_status });
    }
    if (payload.action === "accept" || payload.action === "ignore" || payload.action === "block") {
      const conversationId = Number(payload.conversationId);
      if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return NextResponse.json({ error: "Conversation not found." }, { status: 400 });
      const rows = await sql`SELECT participant_low, participant_high, initiated_by, request_status FROM contributor_conversations WHERE id = ${conversationId} AND ${session.userId} IN (participant_low, participant_high) LIMIT 1`;
      if (!rows.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const conversation = rows[0];
      if (payload.action === "block") {
        const blockedId = Number(conversation.participant_low) === session.userId ? Number(conversation.participant_high) : Number(conversation.participant_low);
        await sql`INSERT INTO contributor_user_blocks (blocker_id, blocked_id) VALUES (${session.userId}, ${blockedId}) ON CONFLICT DO NOTHING`;
        await sql`UPDATE contributor_conversations SET request_status = 'declined' WHERE id = ${conversationId} AND request_status = 'pending'`;
        return NextResponse.json({ ok: true });
      }
      if (Number(conversation.initiated_by) === session.userId || conversation.request_status !== "pending") return NextResponse.json({ error: "This request is no longer waiting for your response." }, { status: 409 });
      const nextStatus = payload.action === "accept" ? "accepted" : "declined";
      await sql`UPDATE contributor_conversations SET request_status = ${nextStatus} WHERE id = ${conversationId} AND request_status = 'pending'`;
      return NextResponse.json({ ok: true, requestStatus: nextStatus });
    }
    if (payload.action === "send") {
      const conversationId = Number(payload.conversationId);
      const body = typeof payload.body === "string" ? payload.body.trim() : "";
      if (!Number.isSafeInteger(conversationId) || conversationId <= 0) return NextResponse.json({ error: "Conversation not found." }, { status: 400 });
      if (!body || body.length > 2000) return NextResponse.json({ error: "Messages must contain 1 to 2,000 characters." }, { status: 400 });
      const access = await sql`SELECT id, request_status, initiated_by, participant_low, participant_high FROM contributor_conversations WHERE id = ${conversationId} AND ${session.userId} IN (participant_low, participant_high) LIMIT 1`;
      if (!access.length) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      const conversation = access[0];
      if (conversation.request_status === "declined") return NextResponse.json({ error: "This message request is closed." }, { status: 403 });
      const blocked = await sql`SELECT 1 FROM contributor_user_blocks WHERE (blocker_id = ${conversation.participant_low} AND blocked_id = ${conversation.participant_high}) OR (blocker_id = ${conversation.participant_high} AND blocked_id = ${conversation.participant_low}) LIMIT 1`;
      if (blocked.length) return NextResponse.json({ error: "This conversation is unavailable." }, { status: 403 });
      if (conversation.request_status === "pending") {
        if (Number(conversation.initiated_by) !== session.userId) return NextResponse.json({ error: "Accept the message request before replying." }, { status: 403 });
        const sent = await sql`SELECT 1 FROM contributor_messages WHERE conversation_id = ${conversationId} LIMIT 1`;
        if (sent.length) return NextResponse.json({ error: "Your message request has been sent. Wait for them to accept before sending another message." }, { status: 403 });
      }
      const rows = await sql`INSERT INTO contributor_messages (conversation_id, sender_id, body) VALUES (${conversationId}, ${session.userId}, ${body}) RETURNING id, sender_id, body, created_at, read_at`;
      return NextResponse.json({ ok: true, message: { ...rows[0], id: Number(rows[0].id), sender_id: Number(rows[0].sender_id) } }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported message action." }, { status: 400 });
  } catch (error) {
    console.error("Contributor message action failed:", error);
    return NextResponse.json({ error: "That message could not be sent. Please try again." }, { status: 503 });
  }
}
